import type { Unit } from "./types";

/**
 * Euros are carried internally in millions (€m). These helpers format for
 * display only.
 */

const eurCompact = new Intl.NumberFormat("en-NL", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const eurPlain = new Intl.NumberFormat("en-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Format a €m amount, e.g. 1234 -> "€1.2B", 12 -> "€12.0M". */
export function formatEurM(millions: number): string {
  const abs = Math.abs(millions);
  const sign = millions < 0 ? "−" : "";
  if (abs >= 1000) return `${sign}${eurCompact.format(abs * 1_000_000)}`;
  return `${sign}€${abs.toFixed(abs < 10 ? 1 : 0)}M`;
}

/** Format a full euro value (already in absolute euros). */
export function formatEur(euros: number): string {
  return eurPlain.format(euros);
}

/** Percentage with sign, e.g. 0.062 -> "+6.2%". */
export function formatPct(rate: number, digits = 1): string {
  const sign = rate > 0 ? "+" : rate < 0 ? "−" : "";
  return `${sign}${Math.abs(rate * 100).toFixed(digits)}%`;
}

/** Basis points with sign, e.g. 0.062 -> "+620 bps". */
export function formatBps(rate: number): string {
  const bps = Math.round(rate * 10000);
  const sign = bps > 0 ? "+" : bps < 0 ? "−" : "";
  return `${sign}${Math.abs(bps).toLocaleString("en-US")} bps`;
}

/** Format a credited return either as € or as bps, per the unit toggle. */
export function formatReturn(rate: number, unit: Unit): string {
  return unit === "bps" ? formatBps(rate) : formatPct(rate);
}

/** A €m magnitude rendered as either euros or basis-points-of-total. */
export function formatFlow(
  millions: number,
  totalCapital: number,
  unit: Unit,
): string {
  if (unit === "bps") {
    const rate = totalCapital === 0 ? 0 : millions / totalCapital;
    return formatBps(rate);
  }
  return formatEurM(millions);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
