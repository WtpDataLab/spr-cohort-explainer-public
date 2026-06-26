"use client";

import { useState } from "react";
import type { Disaggregation, Granularity } from "@/lib/types";
import {
  GRANULARITY_LABEL,
  GRANULARITY_ORDER,
  bandYearsFromCalc,
  subPeriodCount,
} from "@/lib/cohorts";

interface Props {
  report: Granularity;
  /** The definition (band) granularity; report can't be coarser than this. */
  calc: Granularity;
  disaggregation: Disaggregation;
  onChange: (report: Granularity, disaggregation: Disaggregation) => void;
}

const ALL_OPTIONS: Granularity[] = ["5y", "1y", "1m"];

const RULES: Array<{ id: Disaggregation; label: string; blurb: string }> = [
  {
    id: "capital",
    label: "By capital",
    blurb: "Split each band by accumulated capital per period. Older periods carry more.",
  },
  {
    id: "headcount",
    label: "By headcount",
    blurb: "Split by number of participants per period. Evens out the euros, skews the returns.",
  },
  {
    id: "uniform",
    label: "Uniform",
    blurb: "Split equally across the periods. Simplest, but ignores who actually holds the capital.",
  },
];

// Granularity toggle (spec §6.1 #3). Fine -> coarse is deterministic and
// lossless. Coarse -> fine STOPS AND ASKS which disaggregation rule to use,
// because there is no unique inverse, then renders with an "assumption
// applied" badge. Supports 5-year, 1-year and 1-month cohorts.
export default function GranularityControl({
  report,
  calc,
  disaggregation,
  onChange,
}: Props) {
  // Non-null while we ask which rule to apply for a finer target.
  const [pending, setPending] = useState<Granularity | null>(null);
  // Report can equal or be finer than the definition (band) granularity.
  const options = ALL_OPTIONS.filter(
    (g) => GRANULARITY_ORDER[g] >= GRANULARITY_ORDER[calc],
  );

  function selectGranularity(next: Granularity) {
    if (next === report) return;
    if (GRANULARITY_ORDER[next] > GRANULARITY_ORDER[report]) {
      // coarse -> fine: must choose a rule first.
      setPending(next);
    } else {
      // fine -> coarse: lossless, no question.
      onChange(next, disaggregation);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-ink-faint">Granularity</span>
      <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-xs">
        {options.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => selectGranularity(g)}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              report === g ? "bg-ink text-white" : "text-ink-soft hover:bg-slate-100"
            }`}
          >
            {GRANULARITY_LABEL[g]}
          </button>
        ))}
      </div>

      {report !== "5y" && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800"
          title="Finer cohorts were produced by disaggregating five-year bands. This is an assumption with no unique inverse."
        >
          <span aria-hidden>⚠</span>
          assumption applied · {labelFor(disaggregation)}
          <button
            type="button"
            className="ml-1 underline decoration-dotted hover:no-underline"
            onClick={() => setPending(report)}
          >
            change
          </button>
        </span>
      )}

      {pending && (
        <DisaggregationDialog
          target={pending}
          calc={calc}
          current={disaggregation}
          onCancel={() => setPending(null)}
          onConfirm={(rule) => {
            const target = pending;
            setPending(null);
            onChange(target, rule);
          }}
        />
      )}
    </div>
  );
}

function labelFor(rule: Disaggregation): string {
  return RULES.find((r) => r.id === rule)?.label ?? rule;
}

function DisaggregationDialog({
  target,
  calc,
  current,
  onCancel,
  onConfirm,
}: {
  target: Granularity;
  calc: Granularity;
  current: Disaggregation;
  onCancel: () => void;
  onConfirm: (rule: Disaggregation) => void;
}) {
  const [choice, setChoice] = useState<Disaggregation>(current);
  const count = subPeriodCount(bandYearsFromCalc(calc), target);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a disaggregation rule"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink">
          Reporting at {GRANULARITY_LABEL[target]} granularity
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Each five-year band splits into <strong>{count}</strong>{" "}
          {target === "1m" ? "monthly" : "yearly"} sub-cohorts, and there is{" "}
          <strong>no unique inverse</strong>: the choice changes the per-period
          numbers. Pick the rule to apply.
        </p>

        <div className="mt-4 space-y-2">
          {RULES.map((rule) => (
            <label
              key={rule.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                choice === rule.id
                  ? "border-ink bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="disaggregation"
                className="mt-1"
                checked={choice === rule.id}
                onChange={() => setChoice(rule.id)}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  {rule.label}
                </span>
                <span className="block text-xs text-ink-faint">{rule.blurb}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(choice)}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-soft"
          >
            Apply rule
          </button>
        </div>
      </div>
    </div>
  );
}
