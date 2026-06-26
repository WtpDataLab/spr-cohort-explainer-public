import type { Disaggregation, Granularity, Mode, Unit } from "./types";
import {
  DEFAULT_COHORT_PARAMS,
  DEFAULT_SCENARIO,
  GRANULARITY_ORDER,
  calcFromBandYears,
} from "./cohorts";
import { clamp } from "./format";

/** Largest birth-year span we allow, to keep cohort counts sane. */
export const MAX_BIRTH_SPAN = 90;

/** UI-level state that serialises to the URL (spec §6.3). */
export interface AppState {
  marketReturn: number;
  rateChange: number;
  protectionLevel: number;
  mode: Mode;
  unit: Unit;
  report: Granularity;
  disaggregation: Disaggregation;
  /** Highlight a single cohort by id, or null. */
  followCohort: string | null;
  /** Highlight only reserve-related flows. */
  followReserve: boolean;
  // --- Cohort scheme (editable in Build mode) ---
  birthFrom: number;
  birthTo: number;
  bandYears: number;
  referenceYear: number;
}

export const DEFAULT_STATE: AppState = {
  marketReturn: DEFAULT_SCENARIO.marketReturn,
  rateChange: DEFAULT_SCENARIO.rateChange,
  protectionLevel: DEFAULT_SCENARIO.protectionLevel,
  mode: "explain",
  unit: "eur",
  report: "5y",
  disaggregation: "capital",
  followCohort: null,
  followReserve: false,
  birthFrom: DEFAULT_COHORT_PARAMS.birthFrom,
  birthTo: DEFAULT_COHORT_PARAMS.birthTo,
  bandYears: DEFAULT_COHORT_PARAMS.bandYears,
  referenceYear: DEFAULT_COHORT_PARAMS.referenceYear,
};

function num(v: string | null, fallback: number): number {
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Clamp the cohort-scheme fields into a coherent, bounded shape. */
export function normalizeCohortScheme(s: {
  birthFrom: number;
  birthTo: number;
  bandYears: number;
  referenceYear: number;
}): { birthFrom: number; birthTo: number; bandYears: number; referenceYear: number } {
  const referenceYear = clamp(Math.round(s.referenceYear), 1990, 2100);
  const bandYears = s.bandYears === 1 ? 1 : 5;
  let birthTo = clamp(Math.round(s.birthTo), 1900, referenceYear);
  let birthFrom = clamp(Math.round(s.birthFrom), 1900, birthTo);
  if (birthTo - birthFrom > MAX_BIRTH_SPAN) birthFrom = birthTo - MAX_BIRTH_SPAN;
  return { birthFrom, birthTo, bandYears, referenceYear };
}

export function stateToQuery(state: AppState): string {
  const p = new URLSearchParams();
  p.set("mr", round4(state.marketReturn).toString());
  p.set("rc", round4(state.rateChange).toString());
  p.set("pl", round4(state.protectionLevel).toString());
  if (state.mode !== DEFAULT_STATE.mode) p.set("m", state.mode);
  if (state.unit !== DEFAULT_STATE.unit) p.set("u", state.unit);
  if (state.report !== DEFAULT_STATE.report) p.set("g", state.report);
  if (state.disaggregation !== DEFAULT_STATE.disaggregation)
    p.set("d", state.disaggregation);
  if (state.followCohort) p.set("fc", state.followCohort);
  if (state.followReserve) p.set("fr", "1");
  if (state.birthFrom !== DEFAULT_STATE.birthFrom) p.set("bf", String(state.birthFrom));
  if (state.birthTo !== DEFAULT_STATE.birthTo) p.set("bt", String(state.birthTo));
  if (state.bandYears !== DEFAULT_STATE.bandYears) p.set("bw", String(state.bandYears));
  if (state.referenceYear !== DEFAULT_STATE.referenceYear)
    p.set("ry", String(state.referenceYear));
  return p.toString();
}

export function queryToState(params: URLSearchParams): AppState {
  const mode = params.get("m");
  const unit = params.get("u");
  const reportRaw = params.get("g");
  const disaggregation = params.get("d");

  const scheme = normalizeCohortScheme({
    birthFrom: num(params.get("bf"), DEFAULT_STATE.birthFrom),
    birthTo: num(params.get("bt"), DEFAULT_STATE.birthTo),
    bandYears: num(params.get("bw"), DEFAULT_STATE.bandYears),
    referenceYear: num(params.get("ry"), DEFAULT_STATE.referenceYear),
  });

  let report: Granularity =
    reportRaw === "1y" ? "1y" : reportRaw === "1m" ? "1m" : "5y";
  // Report can never be coarser than the definition (band) granularity.
  const calc = calcFromBandYears(scheme.bandYears);
  if (GRANULARITY_ORDER[report] < GRANULARITY_ORDER[calc]) report = calc;

  return {
    marketReturn: clamp(num(params.get("mr"), DEFAULT_STATE.marketReturn), -0.15, 0.2),
    rateChange: clamp(num(params.get("rc"), DEFAULT_STATE.rateChange), -0.01, 0.01),
    protectionLevel: clamp(
      num(params.get("pl"), DEFAULT_STATE.protectionLevel),
      0.3,
      0.8,
    ),
    mode: mode === "build" ? "build" : "explain",
    unit: unit === "bps" ? "bps" : "eur",
    report,
    disaggregation:
      disaggregation === "headcount" || disaggregation === "uniform"
        ? disaggregation
        : "capital",
    followCohort: params.get("fc"),
    followReserve: params.get("fr") === "1",
    ...scheme,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
