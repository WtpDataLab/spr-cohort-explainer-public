# SPR Cohort Allocation Explainer

An interactive, browser-based visual that shows, in motion, how a single
period's **collective** investment result becomes each age cohort's **credited
return** under the Dutch _solidaire premieregeling_ (SPR).

Move the sliders and watch one collective result decompose into a **protection
return**, an **excess return**, and a **solidarity reserve**, then get allocated
to five-year age cohorts. It is **illustrative by design**: no real portfolio or
participant data ever enters it.

> **Illustrative model for explanation only. Not a calculation of any specific
> fund, and not advice.**

**▶ Live demo — [spr-cohort-explainer.wtpdatalab.com](https://spr-cohort-explainer.wtpdatalab.com/)**

**📖 Background reading — [One Return, Many Savers: How a Pension Fund's Single
Result Becomes Each Generation's Credited Return](https://wtpdatalab.com/one-return-many-savers-how-a-pension-funds-single-result-becomes-each-generations-credited-return/)**
— the plain-language companion to this tool. It walks through the same ideas the
visual animates: the split into a stable **protection return** and a volatile
**excess return**, the **toedelingsregels** that give each cohort a different
share, the **solidarity reserve** that cushions retirees, and the **conservation
principle** that keeps credited euros + reserve deposits equal to the collective
result.

---

## Quick start

Requires Node.js 18.18+ (Node 20 LTS recommended).

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static production build -> ./out
npm run typecheck  # tsc --noEmit
npm test           # config + model invariant suites
npm run validate   # typecheck + build + test
```

The app is a fully static export (`output: "export"`), so `npm run build`
produces a plain `out/` directory you can host anywhere static (GitHub Pages,
Netlify, Vercel, Cloudflare Pages, S3, nginx, …). No server or database
required.

To set the canonical / OpenGraph URL for a deployment, provide
`NEXT_PUBLIC_SITE_URL` at build time (defaults to `http://localhost:3000`).

---

## What it does

- **Hero Sankey** — decompose one collective result → protection / excess /
  reserve, then allocate to cohorts. Euros / basis-points toggle.
- **Scenario sliders** (market return, rate change, protection level) with
  smooth re-animation.
- **Solidarity-reserve tank** with a "follow the reserve" focus mode.
- **Granularity** 5-year / 1-year / 1-month, with a coarse→fine stop-and-ask
  (headcount / capital / uniform) and an "assumption applied" badge.
- **Explain / Build modes** — in Build mode, edit the cohort scheme, the
  allocation matrix (with a live sum-to-100% check), and the model assumptions.
- **Exports** — download the scenario as config JSON (round-trippable, ajv
  validated) or a board-ready PDF. URL-encoded state makes every view shareable.

---

## The model (illustrative)

For a single period:

```
collectiveResult = protectionLevel·protectionReturn + (1−protectionLevel)·marketReturn
protectionReturn = BASE_MATCH − RATE_BETA·rateChange      (rate-driven, stable)
excessReturn     = returnSeekingCapital · marketReturn    (residual)
reserveDelta     = fill a slice of excess (good) / drain to cushion (bad)

creditedReturn[c] = W_protection[c]·protectionReturn
                  + W_excess[c]·(excess − reserveIn)
                  + reserveDraw[c]
```

- `W_*` is the **allocation matrix** (illustrative _toedelingsregels_). Each
  cohort row sums to 100%; pools are distributed by `capital × propensity`,
  normalized, so the sum of credited results conserves the collective result.
- Coefficients (`baseMatchReturn`, `rateBeta`, reserve rules, total capital) are
  didactic defaults, **not** calibrated to any fund. They produce the right
  _qualitative_ behaviour: young = mostly excess (volatile), old = mostly
  protection (stable), the reserve cushions retirees in bad years. A fund can
  replace them with its own assumptions in Build mode → "Model assumptions".
- **Granularity asymmetry** — fine→coarse is summation (lossless). Coarse→fine
  has no unique inverse, so the tool stops and asks for a rule and badges the
  result.

> ⚠️ The shipped coefficients are placeholders chosen for legibility, not
> correctness. Do not present the default numbers as real; the persistent
> "illustrative / not advice" disclaimer stays in the UI.

---

## Architecture

- **Next.js 15 (App Router)**, statically exported (`output: "export"`), with URL
  search-params as the shareable source of truth.
- **Rendering split** — React owns state + DOM; `d3-sankey` owns the layout math
  (computed in a `useMemo`, rendered as React-controlled SVG). CSS transitions on
  geometry give smooth re-animation without a full re-layout flash.
- **No datastore, no backend.** Everything runs in the browser.

```
app/
  layout.tsx              SEO metadata (metadataBase from NEXT_PUBLIC_SITE_URL)
  page.tsx                Hero + <Explainer/> + written explainer (static export)
components/
  Explainer.tsx           Client orchestrator: state, URL sync, model, exports
  Sankey.tsx              D3 layout → React SVG, transitions, highlighting
  Controls.tsx            Sliders, presets, euros/bps, stream summary
  ReserveTank.tsx         Fill-level tank + "follow the reserve"
  GranularityControl.tsx  5y / 1y / 1m toggle + coarse→fine dialog + badge
  ModeToggle.tsx          Explain / Build
  BuildPanel.tsx          Cohort scheme editor, allocation matrix, cohort table, SIVI refs
lib/
  model.ts                The engine. Pure, illustrative.
  cohorts.ts              Preset 5y cohorts, default allocation matrix, per-year weights
  config.ts               Build / serialize / parse / validate config
  schema.ts               JSON Schema + SCHEMA_VERSION + DISCLAIMER
  siviFields.ts           Build-mode SIVI field references (soft)
  urlState.ts             URL <-> state
  format.ts               Euro / % / bps formatting
  pdf.ts                  Board-ready PDF export
scripts/
  test-config.mjs         Round-trip check: export → validate → import
  test-model.mjs          Engine invariants (conservation, granularity, coefficients)
```

---

## Config schema

`lib/schema.ts` owns the exported config schema (`schemaVersion: "0.1.0"`). The
exported config JSON is also the tool's import format; `scripts/test-config.mjs`
asserts the round-trip and that invalid configs are rejected by ajv.

---

## Contributing

Issues and pull requests are welcome. By contributing, you agree that your
contributions are licensed under the project license below.

---

## License

**PolyForm Noncommercial License 1.0.0** — see [LICENSE](LICENSE).

This is a source-available, **non-commercial** license: you may use, modify, and
share the software freely for any noncommercial purpose (personal projects,
research, education, nonprofits, government). **Commercial use requires a
separate license** — contact [WtpDataLab](https://wtpdatalab.com/).

Built and maintained by [WtpDataLab](https://wtpdatalab.com/) · [live demo](https://spr-cohort-explainer.wtpdatalab.com/)

© WtpDataLab. Provided as is, without warranty.
