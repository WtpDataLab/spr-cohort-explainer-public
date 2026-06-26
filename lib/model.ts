import type {
  CohortResult,
  Disaggregation,
  Granularity,
  GraphLinkDef,
  GraphNodeDef,
  ModelResult,
  ReserveState,
  Scenario,
  SchemeConfig,
} from "./types";
import { clamp } from "./format";
import {
  perSubPeriodWeights,
  subPeriodCount,
  bandYearsFromCalc,
  GRANULARITY_ORDER,
} from "./cohorts";

// ---------------------------------------------------------------------------
// The protection-return coefficients now live on the scheme (scheme.coefficients)
// so a fund can enter its own validated assumptions (spec §7, §12). The real
// protection-return methods (direct via protection portfolios; indirect via the
// DNB term structure) are named in copy but not separately simulated in v1.
// ---------------------------------------------------------------------------

/** Tiny keep-alive width so the Sankey topology (and 3-column layout) is
 *  stable across scenarios even when a flow shrinks to zero. */
const EPS = 1e-6;

function shareVector(
  capW: number[],
  propensity: number[],
): number[] {
  const products = capW.map((w, i) => w * propensity[i]);
  const sum = products.reduce((s, p) => s + p, 0);
  if (sum <= 0) return capW.slice(); // fallback: pure capital weighting
  return products.map((p) => p / sum);
}

/**
 * The engine. Computes one illustrative period: a single collective result is
 * decomposed into protection / excess / reserve and allocated to cohorts via
 * the allocation matrix (spec §7).
 */
export function computeModel(
  scenario: Scenario,
  scheme: SchemeConfig,
  options?: { report?: Granularity; disaggregation?: Disaggregation },
): ModelResult {
  const { marketReturn, rateChange, protectionLevel } = scenario;
  const { totalCapital, cohorts, allocationMatrix, reserveRules } = scheme;

  const protectionCapital = protectionLevel * totalCapital;
  const returnSeekingCapital = (1 - protectionLevel) * totalCapital;

  // Stage 1: decompose the collective result. Coefficients are the fund's
  // (illustrative defaults until replaced).
  const { baseMatchReturn, rateBeta } = scheme.coefficients;
  const protectionReturnRate = baseMatchReturn - rateBeta * rateChange;
  const protectionEur = protectionCapital * protectionReturnRate;
  const excessEur = returnSeekingCapital * marketReturn; // == collective − protection
  const collectiveEur = protectionEur + excessEur;
  const collectiveReturnRate = totalCapital === 0 ? 0 : collectiveEur / totalCapital;

  // Solidarity reserve: fill in good years, drain in bad (spec §2, §6.1).
  const startBalanceEur = reserveRules.startBalancePct * totalCapital;
  const maxBalanceEur = reserveRules.maxBalancePct * totalCapital;
  let inEur = 0;
  let outEur = 0;
  let allocatableExcessEur = excessEur;
  let drawPoolEur = 0;
  if (excessEur > 0) {
    inEur = Math.min(
      reserveRules.fillFromExcessPct * excessEur,
      Math.max(0, maxBalanceEur - startBalanceEur),
    );
    allocatableExcessEur = excessEur - inEur;
  } else {
    outEur = Math.min(startBalanceEur, reserveRules.drainCapPct * totalCapital);
    drawPoolEur = outEur;
    allocatableExcessEur = excessEur; // the loss is shared by cohorts
  }
  const endBalanceEur = clamp(
    startBalanceEur + inEur - outEur,
    0,
    maxBalanceEur,
  );
  const reserve: ReserveState = {
    startBalanceEur,
    maxBalanceEur,
    inEur,
    outEur,
    endBalanceEur,
    allocatableExcessEur,
    drawPoolEur,
  };

  // Stage 2: allocate each stream to cohorts.
  const capTotal = cohorts.reduce((s, c) => s + c.capital, 0) || 1;
  const capW = cohorts.map((c) => c.capital / capTotal);
  const protProp = cohorts.map((c) => allocationMatrix[c.id]?.protection ?? 0);
  const excProp = cohorts.map((c) => allocationMatrix[c.id]?.excess ?? 0);
  const resProp = cohorts.map((c) => allocationMatrix[c.id]?.reserve ?? 0);

  const shareProt = shareVector(capW, protProp);
  const shareExc = shareVector(capW, excProp);
  const shareRes = shareVector(capW, resProp);

  const cohortResults: CohortResult[] = cohorts.map((c, i) => {
    const pEur = shareProt[i] * protectionEur;
    const eEur = shareExc[i] * allocatableExcessEur;
    const rEur = shareRes[i] * drawPoolEur;
    const creditedEur = pEur + eEur + rEur;
    const creditedReturn = c.capital === 0 ? 0 : creditedEur / c.capital;
    const mp = Math.abs(pEur);
    const me = Math.abs(eEur);
    const mr = Math.abs(rEur);
    const blendTotal = mp + me + mr || 1;
    return {
      cohortId: c.id,
      parentId: c.id,
      label: c.label,
      ageFrom: c.ageFrom,
      ageTo: c.ageTo,
      capital: c.capital,
      protectionEur: pEur,
      excessEur: eEur,
      reserveDrawEur: rEur,
      creditedEur,
      creditedReturn,
      blend: {
        protection: mp / blendTotal,
        excess: me / blendTotal,
        reserve: mr / blendTotal,
      },
    };
  });

  const report = options?.report ?? scheme.granularity.report;
  const disaggregation =
    options?.disaggregation ?? scheme.granularity.disaggregation;

  // Disaggregate only when the report granularity is finer than the definition
  // (calc) granularity. Otherwise show the band-level cohorts as-is.
  const reportFiner =
    GRANULARITY_ORDER[report] > GRANULARITY_ORDER[scheme.granularity.calc];
  const reportedCohorts = reportFiner
    ? disaggregate(cohortResults, scheme, disaggregation, report)
    : cohortResults;

  const graph = buildGraph(
    { protectionEur, excessEur, reserve },
    reportedCohorts,
    collectiveEur,
  );

  return {
    scenario,
    totalCapital,
    protectionCapital,
    returnSeekingCapital,
    protectionReturnRate,
    collectiveReturnRate,
    protectionEur,
    excessEur,
    collectiveEur,
    reserve,
    cohorts: reportedCohorts,
    graph,
  };
}

/**
 * Coarse -> fine: split each five-year cohort's credited euros into finer
 * sub-cohorts (5 one-year, or 60 one-month). There is no unique inverse; the
 * chosen rule is an assumption (spec §7). Re-aggregating is lossless.
 */
function disaggregate(
  coarse: CohortResult[],
  scheme: SchemeConfig,
  rule: Disaggregation,
  target: Granularity,
): CohortResult[] {
  const bandYears = bandYearsFromCalc(scheme.granularity.calc);
  const count = subPeriodCount(bandYears, target); // e.g. 5y band: 5 or 60
  const subsPerYear = target === "1m" ? 12 : 1;
  const out: CohortResult[] = [];
  for (const cr of coarse) {
    const cohort = scheme.cohorts.find((c) => c.id === cr.cohortId);
    if (!cohort || count <= 1) {
      out.push(cr);
      continue;
    }
    // Credited euros split by the chosen rule; capital split by an assumed
    // capital profile. When the rule != capital, per-sub-period returns
    // diverge; that's the asymmetry the toggle teaches.
    const creditW = perSubPeriodWeights(cohort, rule, count, bandYears);
    const capW = perSubPeriodWeights(cohort, "capital", count, bandYears);
    for (let i = 0; i < count; i++) {
      // Youngest sub-period first (matches age ascending within the band).
      const yearOffset = Math.floor(i / subsPerYear);
      const birthYear = cohort.birthTo - yearOffset;
      const age = cohort.ageFrom + yearOffset;
      let id: string;
      let label: string;
      if (target === "1m") {
        const birthMonth = 12 - (i % 12); // i%12 === 0 -> December (youngest)
        const mm = String(birthMonth).padStart(2, "0");
        id = `${birthYear}-${mm}`;
        label = `${birthYear}-${mm} · age ${age}`;
      } else {
        id = `${birthYear}`;
        label = `${birthYear} · age ${age}`;
      }
      const pEur = cr.protectionEur * creditW[i];
      const eEur = cr.excessEur * creditW[i];
      const rEur = cr.reserveDrawEur * creditW[i];
      const capital = cohort.capital * capW[i];
      const creditedEur = pEur + eEur + rEur;
      const mp = Math.abs(pEur);
      const me = Math.abs(eEur);
      const mr = Math.abs(rEur);
      const blendTotal = mp + me + mr || 1;
      out.push({
        cohortId: id,
        parentId: cohort.id,
        label,
        ageFrom: age,
        ageTo: age,
        capital,
        protectionEur: pEur,
        excessEur: eEur,
        reserveDrawEur: rEur,
        creditedEur,
        creditedReturn: capital === 0 ? 0 : creditedEur / capital,
        blend: {
          protection: mp / blendTotal,
          excess: me / blendTotal,
          reserve: mr / blendTotal,
        },
      });
    }
  }
  return out;
}

function buildGraph(
  pools: {
    protectionEur: number;
    excessEur: number;
    reserve: ReserveState;
  },
  cohorts: CohortResult[],
  collectiveEur: number,
): { nodes: GraphNodeDef[]; links: GraphLinkDef[] } {
  const { protectionEur, reserve } = pools;
  const nodes: GraphNodeDef[] = [
    { id: "collective", kind: "collective", label: "Collective result", netEur: collectiveEur },
    { id: "s-protection", kind: "stream", stream: "protection", label: "Protection return", netEur: protectionEur },
    { id: "s-excess", kind: "stream", stream: "excess", label: "Excess return", netEur: reserve.allocatableExcessEur },
    { id: "s-reserve", kind: "reserve", stream: "reserve", label: "Solidarity reserve", netEur: reserve.inEur - reserve.outEur },
  ];
  for (const c of cohorts) {
    nodes.push({
      id: `c-${c.cohortId}`,
      kind: "cohort",
      cohortId: c.cohortId,
      label: c.label,
      netEur: c.creditedEur,
    });
  }

  const links: GraphLinkDef[] = [];
  const mk = (
    source: string,
    target: string,
    signed: number,
    stream: GraphLinkDef["stream"],
    stage: GraphLinkDef["stage"],
  ) => {
    links.push({
      source,
      target,
      value: Math.max(Math.abs(signed), EPS),
      signedValue: signed,
      stream,
      stage,
      negative: signed < 0,
    });
  };

  // Stage 1: decompose (all three always present so the layout is stable).
  mk("collective", "s-protection", protectionEur, "protection", "decompose");
  mk("collective", "s-excess", reserve.allocatableExcessEur, "excess", "decompose");
  mk("collective", "s-reserve", reserve.inEur, "reserve", "decompose");

  // Stage 2: allocate each stream to cohorts.
  for (const c of cohorts) {
    mk("s-protection", `c-${c.cohortId}`, c.protectionEur, "protection", "allocate");
    mk("s-excess", `c-${c.cohortId}`, c.excessEur, "excess", "allocate");
    mk("s-reserve", `c-${c.cohortId}`, c.reserveDrawEur, "reserve", "allocate");
  }

  return { nodes, links };
}

/** Convenience: does each cohort row of the allocation matrix sum to ~100%? */
export function allocationRowSum(row: {
  protection: number;
  excess: number;
  reserve: number;
}): number {
  return row.protection + row.excess + row.reserve;
}
