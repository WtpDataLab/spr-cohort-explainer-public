"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sankey from "./Sankey";
import Controls from "./Controls";
import ReserveTank from "./ReserveTank";
import GranularityControl from "./GranularityControl";
import ModeToggle from "./ModeToggle";
import BuildPanel from "./BuildPanel";
import { computeModel } from "@/lib/model";
import {
  buildAllocationMatrix,
  buildCohorts,
  buildSchemeFromParams,
  buildDefaultScheme,
  calcFromBandYears,
  GRANULARITY_ORDER,
} from "@/lib/cohorts";
import {
  type AppState,
  DEFAULT_STATE,
  normalizeCohortScheme,
  queryToState,
  stateToQuery,
} from "@/lib/urlState";
import { buildConfig, serializeConfig } from "@/lib/config";
import { exportBoardPdf } from "@/lib/pdf";
import { DISCLAIMER } from "@/lib/schema";
import type {
  AllocationRow,
  Granularity,
  Mode,
  SchemeConfig,
  Scenario,
} from "@/lib/types";
import { formatPct } from "@/lib/format";

/** Cohort-scheme params carried in AppState. */
type CohortParams = Pick<
  AppState,
  "birthFrom" | "birthTo" | "bandYears" | "referenceYear"
>;

export default function Explainer() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [scheme, setScheme] = useState<SchemeConfig>(() => buildDefaultScheme());
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  // Hydrate UI state from the URL (after mount, to avoid SSR mismatch).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (Array.from(params.keys()).length > 0) {
      const next = queryToState(params);
      setState(next);
      setScheme((s) =>
        buildSchemeFromParams(
          {
            birthFrom: next.birthFrom,
            birthTo: next.birthTo,
            bandYears: next.bandYears,
            referenceYear: next.referenceYear,
          },
          s.totalCapital,
          { report: next.report, disaggregation: next.disaggregation },
        ),
      );
    }
    setHydrated(true);
  }, []);

  // Keep the URL in sync: the shareable source of truth (spec §6.3).
  useEffect(() => {
    if (!hydrated) return;
    const q = stateToQuery(state);
    window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
  }, [state, hydrated]);

  const scenario: Scenario = {
    marketReturn: state.marketReturn,
    rateChange: state.rateChange,
    protectionLevel: state.protectionLevel,
  };

  const model = useMemo(
    () =>
      computeModel(scenario, scheme, {
        report: state.report,
        disaggregation: state.disaggregation,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.marketReturn,
      state.rateChange,
      state.protectionLevel,
      state.report,
      state.disaggregation,
      scheme,
    ],
  );

  const patch = useCallback(
    (p: Partial<AppState>) => setState((s) => ({ ...s, ...p })),
    [],
  );

  const onMatrixChange = useCallback((cohortId: string, row: AllocationRow) => {
    setScheme((s) => ({
      ...s,
      allocationMatrix: { ...s.allocationMatrix, [cohortId]: row },
    }));
  }, []);

  const onResetMatrix = useCallback(() => {
    setScheme((s) => ({ ...s, allocationMatrix: buildAllocationMatrix(s.cohorts) }));
  }, []);

  const onGranularity = useCallback(
    (report: AppState["report"], disaggregation: AppState["disaggregation"]) => {
      patch({ report, disaggregation });
      setScheme((s) => ({
        ...s,
        granularity: { ...s.granularity, report, disaggregation },
      }));
    },
    [patch],
  );

  // Editing the cohort scheme regenerates the cohorts (and resets the matrix to
  // defaults, since the rule keys change). Report is clamped so it is never
  // coarser than the new definition (band) granularity.
  const onCohortSchemeChange = useCallback(
    (partial: Partial<CohortParams>) => {
      const next = normalizeCohortScheme({
        birthFrom: partial.birthFrom ?? state.birthFrom,
        birthTo: partial.birthTo ?? state.birthTo,
        bandYears: partial.bandYears ?? state.bandYears,
        referenceYear: partial.referenceYear ?? state.referenceYear,
      });
      const calc = calcFromBandYears(next.bandYears);
      const report: Granularity =
        GRANULARITY_ORDER[state.report] < GRANULARITY_ORDER[calc]
          ? calc
          : state.report;
      patch({ ...next, report });
      // Cohort ids change, so the matrix resets; but keep the fund's model
      // assumptions (reserve rules + coefficients).
      setScheme((s) =>
        buildSchemeFromParams(next, s.totalCapital, {
          report,
          disaggregation: state.disaggregation,
          reserveRules: s.reserveRules,
          coefficients: s.coefficients,
        }),
      );
    },
    [state, patch],
  );

  // Model assumptions: partial updates that preserve cohorts + matrix.
  const onCoefficientsChange = useCallback(
    (partial: Partial<SchemeConfig["coefficients"]>) => {
      setScheme((s) => ({ ...s, coefficients: { ...s.coefficients, ...partial } }));
    },
    [],
  );

  const onReserveRulesChange = useCallback(
    (partial: Partial<SchemeConfig["reserveRules"]>) => {
      setScheme((s) => ({ ...s, reserveRules: { ...s.reserveRules, ...partial } }));
    },
    [],
  );

  // Total capital rescales each cohort's absolute capital; rebuild the cohorts
  // (ids unchanged, so the matrix stays valid).
  const onTotalCapitalChange = useCallback(
    (value: number) => {
      const totalCapital = Math.max(1, Math.round(value));
      setScheme((s) => ({
        ...s,
        totalCapital,
        cohorts: buildCohorts(
          {
            birthFrom: state.birthFrom,
            birthTo: state.birthTo,
            bandYears: state.bandYears,
            referenceYear: state.referenceYear,
          },
          totalCapital,
        ),
      }));
    },
    [state.birthFrom, state.birthTo, state.bandYears, state.referenceYear],
  );

  const shareUrl = hydrated
    ? `${window.location.origin}${window.location.pathname}?${stateToQuery(state)}`
    : "";

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${window.location.pathname}?${stateToQuery(state)}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; the address bar already holds the live URL */
    }
  }, [state]);

  const downloadConfig = useCallback(() => {
    const json = serializeConfig(buildConfig(scheme, scenario));
    triggerDownload(json, "spr-config.json", "application/json");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme, scenario]);

  const downloadPdf = useCallback(async () => {
    if (!captureRef.current) return;
    await exportBoardPdf(captureRef.current, {
      title: "SPR cohort allocation (illustrative)",
      subtitle: scenarioSummary(scenario),
      shareUrl,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, shareUrl]);

  const isBuild = state.mode === "build";

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Top bar */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
            S
          </span>
          <span className="text-sm font-semibold text-ink">
            SPR cohort allocation explainer
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle mode={state.mode} onChange={(m: Mode) => patch({ mode: m })} />
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            {copied ? "Link copied ✓" : "Copy link"}
          </button>
          <a
            href="https://github.com/WtpDataLab/spr-cohort-explainer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-ink-faint transition-colors hover:text-ink"
          >
            View source ↗
          </a>
        </div>
      </div>

      {/* Persistent disclaimer (spec §12) */}
      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        {DISCLAIMER}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* Controls column */}
        <aside className="space-y-5">
          <Controls
            marketReturn={state.marketReturn}
            rateChange={state.rateChange}
            protectionLevel={state.protectionLevel}
            unit={state.unit}
            model={model}
            onMarket={(v) => patch({ marketReturn: v })}
            onRate={(v) => patch({ rateChange: v })}
            onProtection={(v) => patch({ protectionLevel: v })}
            onUnit={(u) => patch({ unit: u })}
            onPreset={(s) =>
              patch({
                marketReturn: s.marketReturn,
                rateChange: s.rateChange,
                protectionLevel: s.protectionLevel,
              })
            }
          />
          <ReserveTank
            reserve={model.reserve}
            unit={state.unit}
            totalCapital={model.totalCapital}
            active={state.followReserve}
            onToggle={() => patch({ followReserve: !state.followReserve })}
          />
          <GranularityControl
            report={state.report}
            calc={scheme.granularity.calc}
            disaggregation={state.disaggregation}
            onChange={onGranularity}
          />
        </aside>

        {/* Hero column */}
        <section>
          <div
            ref={captureRef}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">
                One collective result → each cohort&apos;s credited return
              </h2>
              <span className="text-xs text-ink-faint">{scenarioSummary(scenario)}</span>
            </div>
            <Sankey
              model={model}
              unit={state.unit}
              mode={state.mode}
              followCohort={state.followCohort}
              followReserve={state.followReserve}
              onSelectCohort={(id) => patch({ followCohort: id })}
            />
            <Legend />
          </div>

          {/* Selection / focus bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            <span>
              Tip: click a cohort to <strong>follow one cohort</strong>; use the
              tank to <strong>follow the reserve</strong>.
            </span>
            {state.followCohort && (
              <button
                type="button"
                onClick={() => patch({ followCohort: null })}
                className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-ink-soft hover:bg-slate-300"
              >
                Clear cohort focus ✕
              </button>
            )}
          </div>

          {/* Export / artifact row */}
          <div className="mt-4 flex flex-wrap gap-2">
            <ArtifactButton onClick={downloadConfig}>
              ⬇ Download config JSON
            </ArtifactButton>
            <ArtifactButton onClick={downloadPdf}>
              📄 Board-ready PDF
            </ArtifactButton>
          </div>
        </section>
      </div>

      {/* Build-mode panels */}
      {isBuild && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <BuildPanel
            scheme={scheme}
            model={model}
            unit={state.unit}
            followCohort={state.followCohort}
            cohortParams={{
              birthFrom: state.birthFrom,
              birthTo: state.birthTo,
              bandYears: state.bandYears,
              referenceYear: state.referenceYear,
            }}
            onCohortSchemeChange={onCohortSchemeChange}
            onCoefficientsChange={onCoefficientsChange}
            onReserveRulesChange={onReserveRulesChange}
            onTotalCapitalChange={onTotalCapitalChange}
            onMatrixChange={onMatrixChange}
            onResetMatrix={onResetMatrix}
            onSelectCohort={(id) => patch({ followCohort: id })}
          />
        </div>
      )}

    </div>
  );
}

function Legend() {
  const items = [
    { c: "#0e7490", label: "Protection return (rate-driven, stable)" },
    { c: "#b45309", label: "Excess return (return-seeking, volatile)" },
    { c: "#7c3aed", label: "Solidarity reserve" },
    { c: "#dc2626", label: "A loss being allocated" },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-ink-faint">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-sm"
            style={{ backgroundColor: i.c }}
          />
          {i.label}
        </span>
      ))}
      <span className="ml-auto italic">
        Flow width = magnitude · % at right = net credited return
      </span>
    </div>
  );
}

function ArtifactButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
    >
      {children}
    </button>
  );
}

function scenarioSummary(s: Scenario): string {
  return `Market ${formatPct(s.marketReturn)} · Rate ${formatPct(
    s.rateChange,
    2,
  )} · Protection ${Math.round(s.protectionLevel * 100)}%`;
}

function triggerDownload(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
