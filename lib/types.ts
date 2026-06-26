// Core domain types for the SIVI / SPR cohort allocation explainer.
//
// Everything here is ILLUSTRATIVE. The shapes are designed so the exported
// config JSON (see lib/config.ts) is also a valid *import*: a downstream
// system can consume the same schema to execute this mapping on real data.

export type StreamId = "protection" | "excess" | "reserve";

export const STREAM_IDS: StreamId[] = ["protection", "excess", "reserve"];

/** How a cohort's underlying weight is measured. */
export type WeightBasis = "headcount" | "capital" | "uniform";

/** Reporting/calculation granularity (coarsest -> finest: 5y, 1y, 1m). */
export type Granularity = "1m" | "1y" | "5y";

/** The assumption used when going coarse -> fine (no unique inverse). */
export type Disaggregation = "headcount" | "capital" | "uniform";

export type Mode = "explain" | "build";

/** Flow-width unit on the Sankey. */
export type Unit = "eur" | "bps";

export interface Cohort {
  /** e.g. "1956-1960" */
  id: string;
  /** Display label, e.g. "1956–1960 · 65–69" */
  label: string;
  birthFrom: number;
  birthTo: number;
  ageFrom: number;
  ageTo: number;
  /** Illustrative relative headcount weight. */
  headcount: number;
  /** Illustrative relative accumulated capital (€m notional). */
  capital: number;
}

/** One row of the allocation matrix (the illustrative toedelingsregels). */
export interface AllocationRow {
  /** Propensity to receive protection return (0..1). */
  protection: number;
  /** Propensity to receive excess return (0..1). */
  excess: number;
  /** Propensity to receive a reserve draw in bad years (0..1). */
  reserve: number;
}

/** cohortId -> allocation row. */
export type AllocationMatrix = Record<string, AllocationRow>;

/** Coefficients of the (illustrative) protection-return model, spec §7.
 *  protectionReturn rate = baseMatchReturn − rateBeta · rateChange. */
export interface ModelCoefficients {
  /** Stable matching return delivered by the protection portfolio. */
  baseMatchReturn: number;
  /** Sensitivity of the protection return to a rate change. */
  rateBeta: number;
}

export interface ReserveRules {
  /** Reserve balance at period start, as a share of total capital. */
  startBalancePct: number;
  /** Cap on the reserve balance, as a share of total capital. */
  maxBalancePct: number;
  /** Share of positive excess that fills the reserve in good years. */
  fillFromExcessPct: number;
  /** Max share of total capital drained in a bad year. */
  drainCapPct: number;
  drainTrigger: "negativeExcess";
}

export interface GranularitySettings {
  /** Granularity at which the collective result is calculated. */
  calc: Granularity;
  /** Granularity at which cohorts are reported. */
  report: Granularity;
  /** Assumption used if report is finer than calc. */
  disaggregation: Disaggregation;
}

/** The two headline knobs + one advanced knob (spec §6.1, §7). */
export interface Scenario {
  /** Return-seeking portfolio return, -0.15 .. 0.20. */
  marketReturn: number;
  /** Change in interest rates, -0.01 .. 0.01. */
  rateChange: number;
  /** Share of capital held in the protection portfolio, 0.30 .. 0.80. */
  protectionLevel: number;
}

/** The full in-session scheme definition. Exported verbatim as config JSON. */
export interface SchemeConfig {
  schemeId: "SPR";
  /** Notional total collective capital (€m). Illustrative. */
  totalCapital: number;
  cohorts: Cohort[];
  allocationMatrix: AllocationMatrix;
  reserveRules: ReserveRules;
  coefficients: ModelCoefficients;
  granularity: GranularitySettings;
}

// ---------------------------------------------------------------------------
// Model output
// ---------------------------------------------------------------------------

export interface CohortResult {
  cohortId: string;
  /** The band (definition-level) cohort id this result derives from. Equals
   *  cohortId for band-level rows; the parent band id for disaggregated rows. */
  parentId: string;
  label: string;
  ageFrom: number;
  ageTo: number;
  capital: number;
  /** Euros of protection return credited to this cohort (signed). */
  protectionEur: number;
  /** Euros of (allocatable) excess return credited (signed; can be a loss). */
  excessEur: number;
  /** Euros drawn from the reserve to cushion this cohort (>= 0). */
  reserveDrawEur: number;
  /** Net credited euros. */
  creditedEur: number;
  /** Net credited return rate (creditedEur / capital). */
  creditedReturn: number;
  /** Share of |credited| coming from each stream, for the blend display. */
  blend: { protection: number; excess: number; reserve: number };
}

export interface ReserveState {
  startBalanceEur: number;
  maxBalanceEur: number;
  /** Filled into the reserve this period (>= 0). */
  inEur: number;
  /** Drawn from the reserve this period (>= 0). */
  outEur: number;
  endBalanceEur: number;
  /** Excess remaining for cohorts after the fill (signed). */
  allocatableExcessEur: number;
  /** Pool distributed to cohorts as a cushion (>= 0). */
  drawPoolEur: number;
}

export type NodeKind = "collective" | "stream" | "reserve" | "cohort";

export interface GraphNodeDef {
  id: string;
  kind: NodeKind;
  label: string;
  stream?: StreamId;
  cohortId?: string;
  /** Net signed euros associated with the node (for labels). */
  netEur?: number;
}

export interface GraphLinkDef {
  source: string;
  target: string;
  /** Positive magnitude used for the Sankey width. */
  value: number;
  /** Signed euros (negative = a loss being allocated). */
  signedValue: number;
  stream: StreamId;
  /** "decompose" (stage 1) or "allocate" (stage 2). */
  stage: "decompose" | "allocate";
  /** True when the flow represents a loss. */
  negative: boolean;
}

export interface ModelResult {
  scenario: Scenario;
  totalCapital: number;
  protectionCapital: number;
  returnSeekingCapital: number;
  protectionReturnRate: number;
  collectiveReturnRate: number;
  protectionEur: number;
  excessEur: number;
  collectiveEur: number;
  reserve: ReserveState;
  cohorts: CohortResult[];
  graph: { nodes: GraphNodeDef[]; links: GraphLinkDef[] };
}
