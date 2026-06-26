"use client";

import type { ModelResult, Unit } from "@/lib/types";
import { SCENARIO_PRESETS } from "@/lib/cohorts";
import { formatPct, formatFlow } from "@/lib/format";

interface Props {
  marketReturn: number;
  rateChange: number;
  protectionLevel: number;
  unit: Unit;
  model: ModelResult;
  onMarket: (v: number) => void;
  onRate: (v: number) => void;
  onProtection: (v: number) => void;
  onUnit: (u: Unit) => void;
  onPreset: (s: { marketReturn: number; rateChange: number; protectionLevel: number }) => void;
}

export default function Controls({
  marketReturn,
  rateChange,
  protectionLevel,
  unit,
  model,
  onMarket,
  onRate,
  onProtection,
  onUnit,
  onPreset,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {SCENARIO_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.blurb}
            onClick={() => onPreset(p.scenario)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            {p.label}
          </button>
        ))}
      </div>

      <Slider
        label="Market return"
        hint="Return-seeking portfolio"
        value={marketReturn}
        min={-0.15}
        max={0.2}
        step={0.005}
        onChange={onMarket}
        display={formatPct(marketReturn)}
        tone="excess"
      />

      <Slider
        label="Rate change"
        hint="Drives the protection return"
        value={rateChange}
        min={-0.01}
        max={0.01}
        step={0.0005}
        onChange={onRate}
        display={formatPct(rateChange, 2)}
        tone="protection"
      />

      <Slider
        label="Protection level"
        hint="Share of capital in the protection portfolio"
        value={protectionLevel}
        min={0.3}
        max={0.8}
        step={0.01}
        onChange={onProtection}
        display={`${Math.round(protectionLevel * 100)}%`}
        tone="neutral"
      />

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center text-xs">
        <Stat
          label="Protection"
          value={formatFlow(model.protectionEur, model.totalCapital, unit)}
          tone="text-protection"
        />
        <Stat
          label="Excess"
          value={formatFlow(model.excessEur, model.totalCapital, unit)}
          tone="text-excess"
        />
        <Stat
          label="Collective"
          value={formatFlow(model.collectiveEur, model.totalCapital, unit)}
          tone="text-ink"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-faint">Flow units</span>
        <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-xs">
          <UnitButton active={unit === "eur"} onClick={() => onUnit("eur")}>
            Euros
          </UnitButton>
          <UnitButton active={unit === "bps"} onClick={() => onUnit("bps")}>
            Basis points
          </UnitButton>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  display,
  tone,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  tone: "excess" | "protection" | "neutral";
}) {
  const dot =
    tone === "excess"
      ? "bg-excess"
      : tone === "protection"
        ? "bg-protection"
        : "bg-slate-400";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
          {label}
        </label>
        <span className="tabular-nums text-sm font-semibold text-ink">{display}</span>
      </div>
      <input
        type="range"
        className="w-full"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <p className="mt-1 text-xs text-ink-faint">{hint}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div>
      <div className="text-ink-faint">{label}</div>
      <div className={`mt-0.5 font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function UnitButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
        active ? "bg-ink text-white" : "text-ink-soft hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
