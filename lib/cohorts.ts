import type {
  AllocationMatrix,
  AllocationRow,
  Cohort,
  Disaggregation,
  Granularity,
  ModelCoefficients,
  ReserveRules,
  SchemeConfig,
  Scenario,
} from "./types";
import { clamp, round } from "./format";

// Illustrative reference year used to map birth-year bands to ages.
export const REFERENCE_YEAR = 2025;

// Default cohort range (birth years). Editable in Build mode.
export const DEFAULT_BIRTH_FROM = 1951; // oldest
export const DEFAULT_BIRTH_TO = 2000; // youngest
export const DEFAULT_BAND_YEARS = 5;

// Notional total collective capital (€m). One collective portfolio (spec §2).
export const DEFAULT_TOTAL_CAPITAL = 10_000; // €10bn

// --- Curve shape constants (didactic, not calibrated to any fund) ----------
const MIN_AGE = 22;
const RETIRE_AGE = 68;
const RESERVE_LEAN_AGE = 58; // older cohorts start leaning on the reserve
const RESERVE_MAX_PROPENSITY = 0.2;

function repAge(ageFrom: number, ageTo: number): number {
  return (ageFrom + ageTo) / 2;
}

/**
 * Default allocation propensities for a cohort, as a smooth function of age.
 * Young -> mostly excess; old -> mostly protection + a reserve cushion.
 * Rows sum to 1 (the "do weights sum to 100%?" invariant, spec §6.2).
 */
export function defaultAllocationRow(ageFrom: number, ageTo: number): AllocationRow {
  const age = repAge(ageFrom, ageTo);
  const youth = clamp((RETIRE_AGE - age) / (RETIRE_AGE - MIN_AGE), 0, 1);

  const reserve =
    clamp((age - RESERVE_LEAN_AGE) / (90 - RESERVE_LEAN_AGE), 0, 1) *
    RESERVE_MAX_PROPENSITY;

  const excRaw = youth;
  const protRaw = 1 - youth;
  const rem = 1 - reserve;
  const denom = excRaw + protRaw || 1;

  return {
    protection: round((rem * protRaw) / denom, 3),
    excess: round((rem * excRaw) / denom, 3),
    reserve: round(reserve, 3),
  };
}

/**
 * Illustrative capital weight by age: small when young, rising into
 * near-retirement, gently easing in decumulation.
 */
function capitalWeight(age: number): number {
  const base = Math.max(0, age - MIN_AGE);
  const accumulation = Math.pow(base, 1.6);
  const decumulation = age > 70 ? 1 - 0.04 * (age - 70) : 1;
  return accumulation * Math.max(0.4, decumulation);
}

/** Illustrative headcount weight: gently declining with age. */
function headcountWeight(age: number): number {
  return clamp(1.1 - 0.012 * (age - MIN_AGE), 0.4, 1.1);
}

/** Band width (years) implied by the definition/calc granularity. */
export function bandYearsFromCalc(calc: Granularity): number {
  return calc === "1y" ? 1 : 5;
}

/** The definition/calc granularity implied by a band width. */
export function calcFromBandYears(bandYears: number): Granularity {
  return bandYears === 1 ? "1y" : "5y";
}

export interface CohortSchemeParams {
  /** Oldest birth year in scope. */
  birthFrom: number;
  /** Youngest birth year in scope. */
  birthTo: number;
  /** Years per band (the definition granularity: 1 or 5). */
  bandYears: number;
  /** Year used to map birth years to ages. */
  referenceYear: number;
}

export const DEFAULT_COHORT_PARAMS: CohortSchemeParams = {
  birthFrom: DEFAULT_BIRTH_FROM,
  birthTo: DEFAULT_BIRTH_TO,
  bandYears: DEFAULT_BAND_YEARS,
  referenceYear: REFERENCE_YEAR,
};

/**
 * Build a cohort scheme from explicit parameters. Bands are emitted
 * youngest-first (highest birth year at the top of the Sankey). The band width
 * is the definition granularity at which allocation rules are set.
 */
export function buildCohorts(
  params: CohortSchemeParams,
  totalCapital: number,
): Cohort[] {
  const { birthFrom, birthTo, bandYears, referenceYear } = params;
  const width = Math.max(1, Math.round(bandYears));
  const raw: Cohort[] = [];

  for (let top = birthTo; top >= birthFrom; top -= width) {
    const bottom = Math.max(birthFrom, top - width + 1);
    const ageFrom = referenceYear - top; // youngest in band
    const ageTo = referenceYear - bottom; // oldest in band
    const age = repAge(ageFrom, ageTo);
    const single = bottom === top;
    raw.push({
      id: single ? `${top}` : `${bottom}-${top}`,
      label: single
        ? `${top} · age ${ageFrom}`
        : `${bottom}–${top} · age ${ageFrom}–${ageTo}`,
      birthFrom: bottom,
      birthTo: top,
      ageFrom,
      ageTo,
      headcount: headcountWeight(age),
      capital: capitalWeight(age),
    });
  }

  // Normalise capital weights so they sum to the notional total capital,
  // and headcount to 1 (relative).
  const capSum = raw.reduce((s, c) => s + c.capital, 0) || 1;
  const hcSum = raw.reduce((s, c) => s + c.headcount, 0) || 1;
  return raw.map((c) => ({
    ...c,
    capital: round((c.capital / capSum) * totalCapital, 1),
    headcount: round(c.headcount / hcSum, 4),
  }));
}

export function buildAllocationMatrix(cohorts: Cohort[]): AllocationMatrix {
  const m: AllocationMatrix = {};
  for (const c of cohorts) m[c.id] = defaultAllocationRow(c.ageFrom, c.ageTo);
  return m;
}

export const DEFAULT_RESERVE_RULES: ReserveRules = {
  startBalancePct: 0.05,
  maxBalancePct: 0.1,
  fillFromExcessPct: 0.1,
  drainCapPct: 0.03,
  drainTrigger: "negativeExcess",
};

// Illustrative protection-return coefficients (spec §7, §12). Didactic
// placeholders; a fund replaces these with its own validated assumptions.
export const DEFAULT_COEFFICIENTS: ModelCoefficients = {
  baseMatchReturn: 0.02,
  rateBeta: 2.0,
};

export const DEFAULT_SCENARIO: Scenario = {
  marketReturn: 0.06,
  rateChange: 0.0,
  protectionLevel: 0.6,
};

export function buildSchemeFromParams(
  params: CohortSchemeParams,
  totalCapital = DEFAULT_TOTAL_CAPITAL,
  opts?: {
    report?: Granularity;
    disaggregation?: Disaggregation;
    reserveRules?: ReserveRules;
    coefficients?: ModelCoefficients;
  },
): SchemeConfig {
  const cohorts = buildCohorts(params, totalCapital);
  const calc = calcFromBandYears(params.bandYears);
  return {
    schemeId: "SPR",
    totalCapital,
    cohorts,
    allocationMatrix: buildAllocationMatrix(cohorts),
    reserveRules: opts?.reserveRules ?? DEFAULT_RESERVE_RULES,
    coefficients: opts?.coefficients ?? DEFAULT_COEFFICIENTS,
    granularity: {
      calc,
      report: opts?.report ?? calc,
      disaggregation: opts?.disaggregation ?? "capital",
    },
  };
}

export function buildDefaultScheme(
  totalCapital = DEFAULT_TOTAL_CAPITAL,
): SchemeConfig {
  return buildSchemeFromParams(DEFAULT_COHORT_PARAMS, totalCapital);
}

// --- Scenario presets (Explain mode) ---------------------------------------

export interface ScenarioPreset {
  id: string;
  label: string;
  blurb: string;
  scenario: Scenario;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "good-year",
    label: "Good year",
    blurb: "Strong markets, stable rates. Excess flows freely; reserve fills.",
    scenario: { marketReturn: 0.14, rateChange: 0.0, protectionLevel: 0.6 },
  },
  {
    id: "normal-year",
    label: "Normal year",
    blurb: "Modest returns. A balanced split across cohorts.",
    scenario: { marketReturn: 0.06, rateChange: 0.0, protectionLevel: 0.6 },
  },
  {
    id: "crash",
    label: "Market crash",
    blurb:
      "Markets fall hard. Excess turns negative, hitting young cohorts; the reserve drains to cushion retirees.",
    scenario: { marketReturn: -0.12, rateChange: 0.0, protectionLevel: 0.6 },
  },
  {
    id: "rates-up",
    label: "Rates spike",
    blurb:
      "Rates rise 1%. Protection return compresses while excess holds, tilting the other way.",
    scenario: { marketReturn: 0.04, rateChange: 0.01, protectionLevel: 0.6 },
  },
];

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  "5y": "5-year",
  "1y": "1-year",
  "1m": "1-month",
};

/** Coarsest -> finest ordering, used to decide when a disaggregation is needed. */
export const GRANULARITY_ORDER: Record<Granularity, number> = {
  "5y": 0,
  "1y": 1,
  "1m": 2,
};

/**
 * How many sub-cohorts a band of `bandYears` splits into when reported at the
 * given (finer) target granularity.
 */
export function subPeriodCount(bandYears: number, target: Granularity): number {
  if (target === "1m") return bandYears * 12;
  if (target === "1y") return bandYears;
  return 1;
}

/**
 * Per-sub-period weight profile within a band, used for coarse->fine
 * disaggregation. Returns `count` weights summing to 1. This is the *assumption*
 * with no unique inverse (spec §7); different rules give different splits.
 */
export function perSubPeriodWeights(
  cohort: Cohort,
  rule: Disaggregation,
  count: number,
  spanYears: number,
): number[] {
  if (rule === "uniform") return Array.from({ length: count }, () => 1 / count);
  const raw = Array.from({ length: count }, (_, i) => {
    // Mid-point age of sub-period i within the band.
    const age = cohort.ageFrom + (i + 0.5) * (spanYears / count);
    return rule === "capital" ? capitalWeight(age) : headcountWeight(age);
  });
  const sum = raw.reduce((s, w) => s + w, 0) || 1;
  return raw.map((w) => w / sum);
}
