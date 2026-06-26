"use client";

import type { Mode } from "@/lib/types";

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

// One shared model, two skins (spec §6.2). Toggling preserves the scenario.
export default function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
      <button
        type="button"
        onClick={() => onChange("explain")}
        aria-pressed={mode === "explain"}
        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
          mode === "explain" ? "bg-ink text-white" : "text-ink-soft hover:bg-slate-100"
        }`}
        title="Plain language, for boards & trustees"
      >
        Explain
      </button>
      <button
        type="button"
        onClick={() => onChange("build")}
        aria-pressed={mode === "build"}
        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
          mode === "build" ? "bg-ink text-white" : "text-ink-soft hover:bg-slate-100"
        }`}
        title="Technical, for SIVI implementers"
      >
        Build
      </button>
    </div>
  );
}
