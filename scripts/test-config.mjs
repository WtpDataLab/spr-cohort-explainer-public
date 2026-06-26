// Round-trip check for the config schema: export -> validate -> import.
import { buildDefaultScheme, DEFAULT_SCENARIO } from "../lib/cohorts.ts";
import {
  buildConfig,
  serializeConfig,
  parseConfigJson,
  validateConfig,
} from "../lib/config.ts";
import { computeModel } from "../lib/model.ts";

const scheme = buildDefaultScheme();
const config = buildConfig(scheme, DEFAULT_SCENARIO);
const json = serializeConfig(config);

const { valid, errors } = validateConfig(JSON.parse(json));
console.log("schema valid:", valid, errors);

const restored = parseConfigJson(json);
const a = computeModel(DEFAULT_SCENARIO, scheme);
const b = computeModel(restored.scenario ?? DEFAULT_SCENARIO, restored.scheme);

const same =
  Math.abs(a.collectiveEur - b.collectiveEur) < 1e-6 &&
  a.cohorts.length === b.cohorts.length &&
  a.cohorts.every(
    (c, i) => Math.abs(c.creditedReturn - b.cohorts[i].creditedReturn) < 1e-9,
  );

console.log("round-trip model identical:", same);

// A deliberately broken config must be rejected.
const broken = JSON.parse(json);
broken.allocationMatrix["1996-2000"].protection = 5; // > 1
const bad = validateConfig(broken);
console.log("broken rejected:", !bad.valid, bad.errors.slice(0, 1));

// Custom coefficients must change the model and survive a round-trip.
const custom = { ...scheme, coefficients: { baseMatchReturn: 0.035, rateBeta: 5 } };
const customJson = serializeConfig(buildConfig(custom, DEFAULT_SCENARIO));
const restoredCustom = parseConfigJson(customJson).scheme;
const baseRate = computeModel(DEFAULT_SCENARIO, scheme).protectionReturnRate;
const customRate = computeModel(DEFAULT_SCENARIO, restoredCustom).protectionReturnRate;
const coeffOk =
  restoredCustom.coefficients.baseMatchReturn === 0.035 &&
  restoredCustom.coefficients.rateBeta === 5 &&
  Math.abs(customRate - 0.035) < 1e-9 && // rateChange is 0 in DEFAULT_SCENARIO
  Math.abs(baseRate - 0.02) < 1e-9;
console.log(
  "coefficients round-trip:",
  coeffOk,
  "baseRate:",
  baseRate,
  "customRate:",
  customRate,
);

if (!valid || !same || bad.valid || !coeffOk) {
  console.error("FAIL");
  process.exit(1);
}
console.log("OK");
