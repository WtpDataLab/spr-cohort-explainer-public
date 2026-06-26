import Ajv, { type ErrorObject } from "ajv";
import type { SchemeConfig, Scenario, Cohort, WeightBasis } from "./types";
import { configSchema, SCHEMA_VERSION, DISCLAIMER } from "./schema";
import {
  buildAllocationMatrix,
  DEFAULT_COEFFICIENTS,
  DEFAULT_RESERVE_RULES,
} from "./cohorts";

/** The on-disk / over-the-wire config shape (matches the JSON Schema). */
export interface ExportedConfig {
  schemaVersion: string;
  scheme: "SPR";
  totalCapital?: number;
  cohorts: Array<{
    id: string;
    label?: string;
    birthFrom?: number;
    birthTo?: number;
    ageFrom: number;
    ageTo: number;
    headcount?: number;
    capital?: number;
    weightBasis?: WeightBasis;
  }>;
  streams: string[];
  allocationMatrix: Record<
    string,
    { protection: number; excess: number; reserve: number }
  >;
  reserveRules: {
    startBalancePct?: number;
    maxBalancePct?: number;
    fillFromExcessPct: number;
    drainCapPct?: number;
    drainTrigger: "negativeExcess";
  };
  coefficients?: {
    baseMatchReturn?: number;
    rateBeta?: number;
  };
  granularity: {
    calc: "1m" | "1y" | "5y";
    report: "1m" | "1y" | "5y";
    disaggregation: "headcount" | "capital" | "uniform";
  };
  scenario?: Scenario;
  disclaimer?: string;
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn = ajv.compile(configSchema as unknown as object);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateConfig(data: unknown): ValidationResult {
  const valid = validateFn(data) as boolean;
  const errors = valid
    ? []
    : (validateFn.errors ?? []).map(formatAjvError);
  return { valid, errors };
}

function formatAjvError(e: ErrorObject): string {
  const path = e.instancePath || "(root)";
  return `${path} ${e.message ?? "is invalid"}`.trim();
}

const DEFAULT_WEIGHT_BASIS: WeightBasis = "capital";

/** Build the exported config from the in-session scheme (+ optional scenario). */
export function buildConfig(
  scheme: SchemeConfig,
  scenario?: Scenario,
  weightBasis: WeightBasis = DEFAULT_WEIGHT_BASIS,
): ExportedConfig {
  return {
    schemaVersion: SCHEMA_VERSION,
    scheme: scheme.schemeId,
    totalCapital: scheme.totalCapital,
    cohorts: scheme.cohorts.map((c) => ({
      id: c.id,
      label: c.label,
      birthFrom: c.birthFrom,
      birthTo: c.birthTo,
      ageFrom: c.ageFrom,
      ageTo: c.ageTo,
      headcount: c.headcount,
      capital: c.capital,
      weightBasis,
    })),
    streams: ["protection", "excess", "reserve"],
    allocationMatrix: scheme.allocationMatrix,
    reserveRules: scheme.reserveRules,
    coefficients: scheme.coefficients,
    granularity: scheme.granularity,
    ...(scenario ? { scenario } : {}),
    disclaimer: DISCLAIMER,
  };
}

export function serializeConfig(config: ExportedConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Reconstruct an in-session scheme (+ scenario) from a validated config.
 * Missing optional fields are filled with illustrative defaults, so a config
 * authored externally (minimal cohorts) still loads.
 */
export function schemeFromConfig(config: ExportedConfig): {
  scheme: SchemeConfig;
  scenario?: Scenario;
} {
  const totalCapital = config.totalCapital ?? 10_000;
  const cohorts: Cohort[] = config.cohorts.map((c) => ({
    id: c.id,
    label: c.label ?? `${c.id} · age ${c.ageFrom}–${c.ageTo}`,
    birthFrom: c.birthFrom ?? 0,
    birthTo: c.birthTo ?? 0,
    ageFrom: c.ageFrom,
    ageTo: c.ageTo,
    headcount: c.headcount ?? 1,
    capital: c.capital ?? totalCapital / config.cohorts.length,
  }));

  const allocationMatrix =
    config.allocationMatrix && Object.keys(config.allocationMatrix).length > 0
      ? config.allocationMatrix
      : buildAllocationMatrix(cohorts);

  const scheme: SchemeConfig = {
    schemeId: "SPR",
    totalCapital,
    cohorts,
    allocationMatrix,
    reserveRules: {
      startBalancePct:
        config.reserveRules.startBalancePct ??
        DEFAULT_RESERVE_RULES.startBalancePct,
      maxBalancePct:
        config.reserveRules.maxBalancePct ?? DEFAULT_RESERVE_RULES.maxBalancePct,
      fillFromExcessPct: config.reserveRules.fillFromExcessPct,
      drainCapPct:
        config.reserveRules.drainCapPct ?? DEFAULT_RESERVE_RULES.drainCapPct,
      drainTrigger: config.reserveRules.drainTrigger,
    },
    coefficients: {
      baseMatchReturn:
        config.coefficients?.baseMatchReturn ??
        DEFAULT_COEFFICIENTS.baseMatchReturn,
      rateBeta: config.coefficients?.rateBeta ?? DEFAULT_COEFFICIENTS.rateBeta,
    },
    granularity: config.granularity,
  };

  return { scheme, scenario: config.scenario };
}

/** Parse + validate a JSON string into a scheme. Throws on invalid input. */
export function parseConfigJson(json: string): {
  scheme: SchemeConfig;
  scenario?: Scenario;
} {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Not valid JSON.");
  }
  const { valid, errors } = validateConfig(data);
  if (!valid) {
    throw new Error(`Config failed validation:\n${errors.join("\n")}`);
  }
  return schemeFromConfig(data as ExportedConfig);
}
