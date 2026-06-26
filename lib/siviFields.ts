// Build-mode field references (spec §6.2, §10.4).
//
// SOFT reference only. The SIVI VB-PUO schemas are structure-oriented and the
// published examples may be functionally incorrect; UML class diagrams arrive
// with the 2026 prerelease. We map only a few return/allocation fields, and we
// do NOT claim these are authoritative. The allocation rules themselves are
// out of SIVI message scope (spec §2); they are set by the fund/PUO.

export interface SiviFieldRef {
  /** The model quantity this field carries. */
  concept: string;
  /** Illustrative field path in a VB-PUO style message. */
  field: string;
  /** Which message/dataset it would live on. */
  carrier: string;
  note: string;
}

export const SIVI_SOURCE = {
  label: "SIVI VB-PUO JSON Schemas",
  repo: "Stichting-SIVI/VBPUOdsk",
  url: "https://github.com/Stichting-SIVI/VBPUOdsk",
};

export const SIVI_FIELD_REFS: SiviFieldRef[] = [
  {
    concept: "Collective period result",
    field: "Beleggingsresultaat.periodeRendement",
    carrier: "Return dataset (collective portfolio)",
    note: "One collective portfolio, not split by cohort.",
  },
  {
    concept: "Protection return (beschermingsrendement)",
    field: "Rendementstoedeling.beschermingsrendement",
    carrier: "Allocation dataset",
    note: "Rate-driven. Method (direct/indirect via DNB term structure) set by policy, not the message.",
  },
  {
    concept: "Excess return (overrendement)",
    field: "Rendementstoedeling.overrendement",
    carrier: "Allocation dataset",
    note: "From the return-seeking portfolio.",
  },
  {
    concept: "Solidarity reserve movement",
    field: "Solidariteitsreserve.mutatie",
    carrier: "Reserve dataset",
    note: "Fill / draw for the period. Balance reported separately.",
  },
  {
    concept: "Allocation weights (toedelingsregels)",
    field: "(out of message scope)",
    carrier: "Policy document, per fund/PUO",
    note: "Not carried in the SIVI message; shared via policy, modelled here illustratively.",
  },
  {
    concept: "Cohort credited return",
    field: "Rendementstoedeling.cohort[].toegekendRendement",
    carrier: "Allocation dataset (cohort-level)",
    note: "Cohort-level only. Never participant-level in this tool.",
  },
  {
    concept: "Cohort definition",
    field: "Cohort.geboortejaarVan / geboortejaarTot",
    carrier: "Reference data",
    note: "Five-year cohorts are the reporting standard.",
  },
];
