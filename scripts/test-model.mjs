// Engine-invariant checks for the SPR allocation model.
// Run: npx tsx scripts/test-model.mjs
import {
  buildDefaultScheme,
  buildSchemeFromParams,
  DEFAULT_SCENARIO,
  DEFAULT_COHORT_PARAMS,
} from "../lib/cohorts.ts";
import { computeModel, allocationRowSum } from "../lib/model.ts";

let failed = 0;
let passed = 0;
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ": " + detail : ""}`);
  }
}

const scheme = buildDefaultScheme();
const sum = (cs) => cs.reduce((s, c) => s + c.creditedEur, 0);

console.log("\n# Pools (default scenario, default coefficients)");
const m = computeModel(DEFAULT_SCENARIO, scheme);
check("protectionEur = €120M", approx(m.protectionEur, 120), `got ${m.protectionEur}`);
check("excessEur = €240M", approx(m.excessEur, 240), `got ${m.excessEur}`);
check("collectiveEur = €360M", approx(m.collectiveEur, 360), `got ${m.collectiveEur}`);
check("protectionReturnRate = 2%", approx(m.protectionReturnRate, 0.02));
check("reserve fill = €24M", approx(m.reserve.inEur, 24), `got ${m.reserve.inEur}`);
check("reserve end = €524M", approx(m.reserve.endBalanceEur, 524));
check("allocatable excess = €216M", approx(m.reserve.allocatableExcessEur, 216));

console.log("\n# Conservation");
check(
  "good year: Σ credited + fill = collective",
  approx(sum(m.cohorts) + m.reserve.inEur, m.collectiveEur),
  `Σ=${sum(m.cohorts)} fill=${m.reserve.inEur} coll=${m.collectiveEur}`,
);

console.log("\n# Protection responds to rates (rate up -> protection down)");
const rUp = computeModel({ marketReturn: 0.06, rateChange: 0.01, protectionLevel: 0.6 }, scheme);
check("protectionRate = base − β·rate", approx(rUp.protectionReturnRate, 0.02 - 2.0 * 0.01));
check("rate up lowers protection rate", rUp.protectionReturnRate < m.protectionReturnRate);

console.log("\n# Crash scenario (market −12%)");
const crash = computeModel({ marketReturn: -0.12, rateChange: 0, protectionLevel: 0.6 }, scheme);
check("excess turns negative", crash.excessEur < 0, `excess=${crash.excessEur}`);
check("reserve drains (out>0, in=0)", crash.reserve.outEur > 0 && crash.reserve.inEur === 0);
check("draw pool = drained amount", approx(crash.reserve.drawPoolEur, crash.reserve.outEur));
check(
  "conservation: Σ credited = collective + draw",
  approx(sum(crash.cohorts), crash.collectiveEur + crash.reserve.drawPoolEur),
);
check("youngest cohort goes negative", crash.cohorts[0].creditedReturn < 0);
check(
  "oldest cushioned above youngest",
  crash.cohorts.at(-1).creditedReturn > crash.cohorts[0].creditedReturn,
);

console.log("\n# Coefficients drive the model");
const custom = { ...scheme, coefficients: { baseMatchReturn: 0.05, rateBeta: 2 } };
const cm = computeModel(DEFAULT_SCENARIO, custom);
check("base 5% -> protection €300M", approx(cm.protectionEur, 300), `got ${cm.protectionEur}`);

console.log("\n# Blend direction (young excess, old protection)");
check("youngest excess-dominant", m.cohorts[0].blend.excess > m.cohorts[0].blend.protection);
check("oldest protection-dominant", m.cohorts.at(-1).blend.protection > m.cohorts.at(-1).blend.excess);

console.log("\n# Allocation rows sum to ~100%");
let rowsOk = true;
for (const c of scheme.cohorts) {
  if (!approx(allocationRowSum(scheme.allocationMatrix[c.id]), 1, 5e-3)) rowsOk = false;
}
check("every allocation row sums to 1", rowsOk);

console.log("\n# Granularity is lossless (Σ credited invariant)");
const t5 = sum(computeModel(DEFAULT_SCENARIO, scheme, { report: "5y" }).cohorts);
const m1y = computeModel(DEFAULT_SCENARIO, scheme, { report: "1y", disaggregation: "capital" });
const m1m = computeModel(DEFAULT_SCENARIO, scheme, { report: "1m", disaggregation: "headcount" });
check("1y count = 50", m1y.cohorts.length === 50, `got ${m1y.cohorts.length}`);
check("1m count = 600", m1m.cohorts.length === 600, `got ${m1m.cohorts.length}`);
check("1y Σ credited = 5y Σ", approx(sum(m1y.cohorts), t5));
check("1m Σ credited = 5y Σ", approx(sum(m1m.cohorts), t5));

// Per-band losslessness + the capital/uniform asymmetry.
const m5 = computeModel(DEFAULT_SCENARIO, scheme, { report: "5y" });
const bandCredit = Object.fromEntries(m5.cohorts.map((c) => [c.cohortId, c.creditedEur]));
const grouped = {};
for (const c of m1y.cohorts) grouped[c.parentId] = (grouped[c.parentId] || 0) + c.creditedEur;
check(
  "each band's 1y children re-sum to the band",
  Object.keys(bandCredit).every((id) => approx(grouped[id] || 0, bandCredit[id])),
);

const band = m5.cohorts.find((c) => c.cohortId === "1996-2000");
const capKids = computeModel(DEFAULT_SCENARIO, scheme, { report: "1y", disaggregation: "capital" })
  .cohorts.filter((c) => c.parentId === "1996-2000");
check(
  "capital rule -> per-year returns flat (= band)",
  capKids.every((k) => approx(k.creditedReturn, band.creditedReturn)),
);
const uniKids = computeModel(DEFAULT_SCENARIO, scheme, { report: "1y", disaggregation: "uniform" })
  .cohorts.filter((c) => c.parentId === "1996-2000");
check(
  "uniform rule -> per-year returns differ (asymmetry)",
  !uniKids.every((k) => approx(k.creditedReturn, uniKids[0].creditedReturn, 1e-9)),
);

console.log("\n# Graph integrity (no NaN / non-positive widths)");
let graphOk = true;
for (const l of m1m.graph.links) {
  if (!Number.isFinite(l.value) || l.value <= 0 || !Number.isFinite(l.signedValue)) graphOk = false;
}
check("all link widths finite & > 0 (incl. 1m view)", graphOk);
check("all credited returns finite", m1m.cohorts.every((c) => Number.isFinite(c.creditedReturn)));

console.log("\n# 1-year band width (definition granularity)");
const scheme1yBand = buildSchemeFromParams({ ...DEFAULT_COHORT_PARAMS, bandYears: 1 });
const mb = computeModel(DEFAULT_SCENARIO, scheme1yBand, { report: "1y" });
check("1y band scheme has 50 band cohorts", scheme1yBand.cohorts.length === 50);
check(
  "report=calc -> no disaggregation (parentId == id)",
  mb.cohorts.length === 50 && mb.cohorts.every((c) => c.parentId === c.cohortId),
);

console.log(`\n${failed === 0 ? "ALL PASS" : "SOME FAILED"}: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
