"use client";

import type {
  AllocationRow,
  ModelCoefficients,
  ModelResult,
  ReserveRules,
  SchemeConfig,
  Unit,
} from "@/lib/types";
import { allocationRowSum } from "@/lib/model";
import { formatFlow, formatReturn, formatEurM } from "@/lib/format";
import { GRANULARITY_LABEL } from "@/lib/cohorts";
import { SIVI_FIELD_REFS, SIVI_SOURCE } from "@/lib/siviFields";

export interface CohortParams {
  birthFrom: number;
  birthTo: number;
  bandYears: number;
  referenceYear: number;
}

interface Props {
  scheme: SchemeConfig;
  model: ModelResult;
  unit: Unit;
  followCohort: string | null;
  cohortParams: CohortParams;
  onCohortSchemeChange: (partial: Partial<CohortParams>) => void;
  onCoefficientsChange: (partial: Partial<ModelCoefficients>) => void;
  onReserveRulesChange: (partial: Partial<ReserveRules>) => void;
  onTotalCapitalChange: (value: number) => void;
  onMatrixChange: (cohortId: string, row: AllocationRow) => void;
  onResetMatrix: () => void;
  onSelectCohort: (id: string | null) => void;
}

export default function BuildPanel({
  scheme,
  model,
  unit,
  followCohort,
  cohortParams,
  onCohortSchemeChange,
  onCoefficientsChange,
  onReserveRulesChange,
  onTotalCapitalChange,
  onMatrixChange,
  onResetMatrix,
  onSelectCohort,
}: Props) {
  return (
    <div className="space-y-8">
      <CohortSchemeEditor
        params={cohortParams}
        cohortCount={scheme.cohorts.length}
        onChange={onCohortSchemeChange}
      />
      <ModelAssumptionsEditor
        scheme={scheme}
        model={model}
        onCoefficientsChange={onCoefficientsChange}
        onReserveRulesChange={onReserveRulesChange}
        onTotalCapitalChange={onTotalCapitalChange}
      />
      <AllocationMatrixEditor
        scheme={scheme}
        model={model}
        onMatrixChange={onMatrixChange}
        onResetMatrix={onResetMatrix}
      />
      <CohortTable
        model={model}
        unit={unit}
        followCohort={followCohort}
        onSelectCohort={onSelectCohort}
      />
      <GranularityMapping scheme={scheme} />
      <SiviFieldReferences />
    </div>
  );
}

function CohortSchemeEditor({
  params,
  cohortCount,
  onChange,
}: {
  params: CohortParams;
  cohortCount: number;
  onChange: (partial: Partial<CohortParams>) => void;
}) {
  const { birthFrom, birthTo, bandYears, referenceYear } = params;
  const ageYoungest = referenceYear - birthTo;
  const ageOldest = referenceYear - birthFrom;
  return (
    <section>
      <SectionHeader
        title="Cohort scheme"
        subtitle="Define the population and band width. The band width is the level at which allocation rules are set."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField
          label="Earliest birth year"
          value={birthFrom}
          min={1900}
          max={birthTo}
          onCommit={(v) => onChange({ birthFrom: v })}
        />
        <NumberField
          label="Latest birth year"
          value={birthTo}
          min={birthFrom}
          max={referenceYear}
          onCommit={(v) => onChange({ birthTo: v })}
        />
        <NumberField
          label="Reference year"
          value={referenceYear}
          min={1990}
          max={2100}
          onCommit={(v) => onChange({ referenceYear: v })}
        />
        <div>
          <div className="mb-1 text-xs font-medium text-ink-faint">Band width</div>
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onChange({ bandYears: 5 })}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                bandYears === 5 ? "bg-ink text-white" : "text-ink-soft hover:bg-slate-100"
              }`}
            >
              5-year
            </button>
            <button
              type="button"
              onClick={() => onChange({ bandYears: 1 })}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                bandYears === 1 ? "bg-ink text-white" : "text-ink-soft hover:bg-slate-100"
              }`}
            >
              1-year
            </button>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        {cohortCount} bands · ages {ageYoungest}–{ageOldest} at reference year{" "}
        {referenceYear}. Allocation rules are defined at the{" "}
        {bandYears === 1 ? "1-year" : "5-year"} band level; finer reporting is a
        disaggregation of these.
      </p>
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onCommit: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-faint">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          defaultValue={value}
          key={value}
          min={min}
          max={max}
          step={step}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v !== value) onCommit(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm tabular-nums focus:border-ink focus:outline-none"
        />
        {suffix && <span className="text-xs text-ink-faint">{suffix}</span>}
      </div>
    </label>
  );
}

function ModelAssumptionsEditor({
  scheme,
  model,
  onCoefficientsChange,
  onReserveRulesChange,
  onTotalCapitalChange,
}: {
  scheme: SchemeConfig;
  model: ModelResult;
  onCoefficientsChange: (partial: Partial<ModelCoefficients>) => void;
  onReserveRulesChange: (partial: Partial<ReserveRules>) => void;
  onTotalCapitalChange: (value: number) => void;
}) {
  const c = scheme.coefficients;
  const r = scheme.reserveRules;
  const pct = (n: number) => Math.round(n * 1000) / 10; // fraction -> % (1dp)
  return (
    <section>
      <SectionHeader
        title="Model assumptions"
        subtitle="The fund's own coefficients. Replace these illustrative placeholders with your validated numbers; that's the credibility gate (spec §10.6, §14)."
      />
      <div className="rounded-xl border border-slate-200 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-protection">
          Protection return
        </h4>
        <p className="mb-2 mt-0.5 font-mono text-xs text-ink-faint">
          protectionReturn = baseMatch − β × rateChange = {pct(c.baseMatchReturn)}%
          − {c.rateBeta} × {pct(model.scenario.rateChange)}% ={" "}
          {pct(model.protectionReturnRate)}%
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField
            label="Base matching return"
            value={pct(c.baseMatchReturn)}
            step={0.1}
            min={-5}
            max={10}
            suffix="%"
            onCommit={(v) => onCoefficientsChange({ baseMatchReturn: v / 100 })}
          />
          <NumberField
            label="Rate sensitivity β"
            value={c.rateBeta}
            step={0.1}
            min={0}
            max={20}
            onCommit={(v) => onCoefficientsChange({ rateBeta: v })}
          />
          <NumberField
            label="Collective capital"
            value={scheme.totalCapital}
            step={100}
            min={1}
            suffix="€m"
            onCommit={onTotalCapitalChange}
          />
        </div>

        <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-reserve">
          Solidarity reserve
        </h4>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField
            label="Start balance"
            value={pct(r.startBalancePct)}
            step={0.5}
            min={0}
            max={100}
            suffix="%"
            onCommit={(v) => onReserveRulesChange({ startBalancePct: v / 100 })}
          />
          <NumberField
            label="Cap"
            value={pct(r.maxBalancePct)}
            step={0.5}
            min={0}
            max={100}
            suffix="%"
            onCommit={(v) => onReserveRulesChange({ maxBalancePct: v / 100 })}
          />
          <NumberField
            label="Fill from excess"
            value={pct(r.fillFromExcessPct)}
            step={0.5}
            min={0}
            max={100}
            suffix="%"
            onCommit={(v) => onReserveRulesChange({ fillFromExcessPct: v / 100 })}
          />
          <NumberField
            label="Drain cap"
            value={pct(r.drainCapPct)}
            step={0.5}
            min={0}
            max={100}
            suffix="%"
            onCommit={(v) => onReserveRulesChange({ drainCapPct: v / 100 })}
          />
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          These assumptions are saved in the exported config JSON. The real
          protection methods (direct via protection portfolios; indirect via the
          DNB term structure) are named, not separately simulated.
        </p>
      </div>
    </section>
  );
}

function AllocationMatrixEditor({
  scheme,
  model,
  onMatrixChange,
  onResetMatrix,
}: {
  scheme: SchemeConfig;
  model: ModelResult;
  onMatrixChange: (cohortId: string, row: AllocationRow) => void;
  onResetMatrix: () => void;
}) {
  const { calc, report } = scheme.granularity;
  // The matrix mirrors the cohort table (report granularity). Rules are only
  // editable at the band (definition) level; finer rows are read-only copies.
  const editingActive = report === calc;
  return (
    <section>
      <SectionHeader
        title="Allocation matrix"
        subtitle="cohort × stream = the illustrative toedelingsregels. Mirrors the cohort table; each row should sum to 100%."
        action={
          <button
            type="button"
            onClick={onResetMatrix}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-ink-soft hover:border-ink hover:text-ink"
          >
            Reset to defaults
          </button>
        }
      />
      {!editingActive && (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Rules are defined at the {GRANULARITY_LABEL[calc]} band level. These{" "}
          {GRANULARITY_LABEL[report]} rows are <strong>derived copies</strong> of
          the band rule and read-only. Set granularity to {GRANULARITY_LABEL[calc]}{" "}
          to edit the weights.
        </p>
      )}
      <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2">Cohort</th>
              <th className="px-3 py-2 text-protection">Protection</th>
              <th className="px-3 py-2 text-excess">Excess</th>
              <th className="px-3 py-2 text-reserve">Reserve</th>
              <th className="px-3 py-2">Σ</th>
            </tr>
          </thead>
          <tbody>
            {model.cohorts.map((c) => {
              const row = scheme.allocationMatrix[c.parentId];
              if (!row) return null;
              const editable = editingActive && c.cohortId === c.parentId;
              const sum = allocationRowSum(row);
              const ok = Math.abs(sum - 1) < 0.005;
              return (
                <tr key={c.cohortId} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-1.5 text-ink-soft">
                    {c.label}
                  </td>
                  {(["protection", "excess", "reserve"] as const).map((stream) =>
                    editable ? (
                      <td key={stream} className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={round2(row[stream])}
                          onChange={(e) =>
                            onMatrixChange(c.parentId, {
                              ...row,
                              [stream]: clamp01(Number(e.target.value)),
                            })
                          }
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-right tabular-nums focus:border-ink focus:outline-none"
                        />
                      </td>
                    ) : (
                      <td
                        key={stream}
                        className="px-3 py-1.5 text-right tabular-nums text-ink-faint"
                      >
                        {round2(row[stream]).toFixed(2)}
                      </td>
                    ),
                  )}
                  <td
                    className={`px-3 py-1.5 tabular-nums font-semibold ${
                      ok ? "text-green-700" : "text-red-600"
                    }`}
                    title={ok ? "Weights sum to 100%" : "Weights do not sum to 100%"}
                  >
                    {Math.round(sum * 100)}%{ok ? "" : " ⚠"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CohortTable({
  model,
  unit,
  followCohort,
  onSelectCohort,
}: {
  model: ModelResult;
  unit: Unit;
  followCohort: string | null;
  onSelectCohort: (id: string | null) => void;
}) {
  return (
    <section>
      <SectionHeader
        title="Cohort table"
        subtitle={`What you'd produce: credited return per cohort (${model.cohorts.length} rows), decomposed by stream.`}
      />
      <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2">Cohort</th>
              <th className="px-3 py-2 text-right">Capital</th>
              <th className="px-3 py-2 text-right text-protection">Protection</th>
              <th className="px-3 py-2 text-right text-excess">Excess</th>
              <th className="px-3 py-2 text-right text-reserve">Reserve draw</th>
              <th className="px-3 py-2 text-right">Credited</th>
              <th className="px-3 py-2 text-right">Return</th>
            </tr>
          </thead>
          <tbody>
            {model.cohorts.map((c) => {
              const selected = c.cohortId === followCohort;
              return (
                <tr
                  key={c.cohortId}
                  className={`cursor-pointer border-t border-slate-100 ${
                    selected ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                  onClick={() =>
                    onSelectCohort(selected ? null : c.cohortId)
                  }
                >
                  <td className="whitespace-nowrap px-3 py-1.5 text-ink-soft">
                    {c.label}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatEurM(c.capital)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatFlow(c.protectionEur, model.totalCapital, unit)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatFlow(c.excessEur, model.totalCapital, unit)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatFlow(c.reserveDrawEur, model.totalCapital, unit)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                    {formatFlow(c.creditedEur, model.totalCapital, unit)}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums font-semibold ${
                      c.creditedReturn >= 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {formatReturn(c.creditedReturn, unit)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GranularityMapping({ scheme }: { scheme: SchemeConfig }) {
  const { calc, report, disaggregation } = scheme.granularity;
  const needsBridge = report !== "5y" && calc === "5y";
  return (
    <section>
      <SectionHeader
        title="Granularity mapping"
        subtitle="Calculation vs reporting granularity, and the assumption bridging them."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MapCard label="Calculated at" value={GRANULARITY_LABEL[calc]} />
        <MapCard label="Reported at" value={GRANULARITY_LABEL[report]} />
        <MapCard
          label="Bridge"
          value={
            needsBridge
              ? `disaggregate · ${disaggregation}`
              : "None (no disaggregation)"
          }
          warn={needsBridge}
        />
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Fine → coarse is summation (lossless). Coarse → fine has no unique
        inverse and requires the assumption above, which is surfaced, not hidden.
      </p>
    </section>
  );
}

function SiviFieldReferences() {
  return (
    <section>
      <SectionHeader
        title="SIVI field references"
        subtitle="Where each number would live in a VB-PUO message. Soft reference; map only a few fields."
      />
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2">Concept</th>
              <th className="px-3 py-2">Field (illustrative)</th>
              <th className="px-3 py-2">Carrier</th>
            </tr>
          </thead>
          <tbody>
            {SIVI_FIELD_REFS.map((f) => (
              <tr key={f.concept} className="border-t border-slate-100 align-top">
                <td className="px-3 py-1.5 font-medium text-ink-soft">
                  {f.concept}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs text-ink">
                  {f.field}
                  <span className="mt-0.5 block font-sans text-[11px] text-ink-faint">
                    {f.note}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-xs text-ink-faint">{f.carrier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Source:{" "}
        <a
          href={SIVI_SOURCE.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted hover:no-underline"
        >
          {SIVI_SOURCE.label} ({SIVI_SOURCE.repo})
        </a>
        . Published examples are structure-oriented and may be functionally
        incorrect; treat as a soft reference.
      </p>
    </section>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="text-xs text-ink-faint">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function MapCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        warn ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-xs text-ink-faint">{label}</div>
      <div className="mt-0.5 font-semibold text-ink">{value}</div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
