// JSON Schema for the exported config. The exported config JSON is also the
// tool's own import format; keep it versioned so the two never drift.

export const SCHEMA_VERSION = "0.1.0";

export const DISCLAIMER =
  "Illustrative model for explanation only. Not a calculation of any specific fund, and not advice.";

export const configSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://wtpdatalab.com/schemas/spr-config-0.1.0.json",
  title: "SPR cohort allocation config",
  type: "object",
  required: [
    "schemaVersion",
    "scheme",
    "cohorts",
    "streams",
    "allocationMatrix",
    "reserveRules",
    "granularity",
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", const: SCHEMA_VERSION },
    scheme: { type: "string", enum: ["SPR"] },
    totalCapital: { type: "number", exclusiveMinimum: 0 },
    cohorts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "ageFrom", "ageTo"],
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          birthFrom: { type: "integer" },
          birthTo: { type: "integer" },
          ageFrom: { type: "integer", minimum: 0, maximum: 120 },
          ageTo: { type: "integer", minimum: 0, maximum: 120 },
          headcount: { type: "number", minimum: 0 },
          capital: { type: "number", minimum: 0 },
          weightBasis: { type: "string", enum: ["headcount", "capital", "uniform"] },
        },
      },
    },
    streams: {
      type: "array",
      items: { type: "string", enum: ["protection", "excess", "reserve"] },
    },
    allocationMatrix: {
      type: "object",
      additionalProperties: {
        type: "object",
        required: ["protection", "excess", "reserve"],
        additionalProperties: false,
        properties: {
          protection: { type: "number", minimum: 0, maximum: 1 },
          excess: { type: "number", minimum: 0, maximum: 1 },
          reserve: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    reserveRules: {
      type: "object",
      required: ["fillFromExcessPct", "drainTrigger"],
      additionalProperties: false,
      properties: {
        startBalancePct: { type: "number", minimum: 0, maximum: 1 },
        maxBalancePct: { type: "number", minimum: 0, maximum: 1 },
        fillFromExcessPct: { type: "number", minimum: 0, maximum: 1 },
        drainCapPct: { type: "number", minimum: 0, maximum: 1 },
        drainTrigger: { type: "string", enum: ["negativeExcess"] },
      },
    },
    coefficients: {
      type: "object",
      additionalProperties: false,
      properties: {
        baseMatchReturn: { type: "number" },
        rateBeta: { type: "number" },
      },
    },
    granularity: {
      type: "object",
      required: ["calc", "report", "disaggregation"],
      additionalProperties: false,
      properties: {
        calc: { type: "string", enum: ["1m", "1y", "5y"] },
        report: { type: "string", enum: ["1m", "1y", "5y"] },
        disaggregation: { type: "string", enum: ["headcount", "capital", "uniform"] },
      },
    },
    scenario: {
      type: "object",
      additionalProperties: false,
      properties: {
        marketReturn: { type: "number" },
        rateChange: { type: "number" },
        protectionLevel: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    disclaimer: { type: "string" },
  },
} as const;
