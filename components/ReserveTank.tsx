"use client";

import type { ReserveState, Unit } from "@/lib/types";
import { formatFlow } from "@/lib/format";

interface Props {
  reserve: ReserveState;
  unit: Unit;
  totalCapital: number;
  active: boolean;
  onToggle: () => void;
}

// The solidarity reserve as a fill-level tank (spec §6.1 #2). A slice of excess
// bends into it in good years; it drains to cushion cohorts in bad years.
export default function ReserveTank({
  reserve,
  unit,
  totalCapital,
  active,
  onToggle,
}: Props) {
  const W = 120;
  const H = 180;
  const max = reserve.maxBalanceEur || 1;
  const startFrac = clampFrac(reserve.startBalanceEur / max);
  const endFrac = clampFrac(reserve.endBalanceEur / max);

  const tankTop = 16;
  const tankH = H - 40;
  const startY = tankTop + tankH * (1 - startFrac);
  const endY = tankTop + tankH * (1 - endFrac);

  const filling = reserve.inEur > 0;
  const draining = reserve.outEur > 0;

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        active ? "border-reserve bg-reserve/5" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Solidarity reserve</h3>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            active
              ? "bg-reserve text-white"
              : "bg-slate-100 text-ink-soft hover:bg-slate-200"
          }`}
          aria-pressed={active}
        >
          Follow the reserve
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
          {/* Tank outline */}
          <rect
            x={28}
            y={tankTop}
            width={64}
            height={tankH}
            rx={6}
            fill="#f1f5f9"
            stroke="#cbd5e1"
          />
          {/* Fill */}
          <rect
            x={28}
            y={endY}
            width={64}
            height={tankTop + tankH - endY}
            rx={6}
            fill="#7c3aed"
            opacity={0.85}
            style={{ transition: "y 400ms ease, height 400ms ease" }}
          />
          {/* Start level marker */}
          <line
            x1={22}
            x2={98}
            y1={startY}
            y2={startY}
            stroke="#475569"
            strokeDasharray="3 3"
            style={{ transition: "y1 400ms ease, y2 400ms ease" }}
          />
          <text x={100} y={startY + 3} fontSize={8} fill="#475569">
            start
          </text>
          {/* Direction arrow */}
          {(filling || draining) && (
            <text
              x={60}
              y={draining ? tankTop + tankH + 12 : tankTop - 4}
              textAnchor="middle"
              fontSize={14}
              fill={draining ? "#dc2626" : "#15803d"}
            >
              {draining ? "▼ drain" : "▲ fill"}
            </text>
          )}
        </svg>

        <dl className="space-y-1 text-xs">
          <Row label="Start" value={formatFlow(reserve.startBalanceEur, totalCapital, unit)} />
          <Row
            label={filling ? "Filled" : "Drained"}
            value={formatFlow(
              filling ? reserve.inEur : -reserve.outEur,
              totalCapital,
              unit,
            )}
            accent={filling ? "text-green-700" : "text-red-600"}
          />
          <Row
            label="End"
            value={formatFlow(reserve.endBalanceEur, totalCapital, unit)}
            strong
          />
          <Row label="Cap" value={formatFlow(reserve.maxBalanceEur, totalCapital, unit)} muted />
        </dl>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted ? "text-slate-400" : "text-ink-faint"}>{label}</dt>
      <dd
        className={`tabular-nums ${strong ? "font-semibold text-ink" : ""} ${
          accent ?? ""
        } ${muted ? "text-slate-400" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function clampFrac(f: number): number {
  return Math.min(1, Math.max(0, f));
}
