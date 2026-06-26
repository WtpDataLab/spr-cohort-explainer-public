import { Suspense } from "react";
import Explainer from "@/components/Explainer";

export default function Page() {
  return (
    <main className="pb-24">
      {/* Hero / pitch */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-protection">
            Wtp · solidaire premieregeling
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            See how a pension fund&apos;s return turns into your cohort&apos;s
            return.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-soft">
            One collective portfolio. One period result. Watch it decompose into{" "}
            <span className="font-medium text-protection">protection return</span>,{" "}
            <span className="font-medium text-excess">excess return</span> and a{" "}
            <span className="font-medium text-reserve">solidarity reserve</span>,
            then get allocated to five-year age cohorts. Move the sliders and the
            whole picture re-animates.
          </p>
        </div>
      </header>

      {/* The interactive tool */}
      <div className="py-8">
        <Suspense fallback={<div className="px-4 text-sm text-ink-faint">Loading…</div>}>
          <Explainer />
        </Suspense>
      </div>

      {/* Written explainer (SEO + credibility) */}
      <article className="mx-auto mt-8 max-w-3xl space-y-10 px-4">
        <Prose
          title="Cohorts are an overlay, not a split"
          id="how-it-works"
        >
          <p>
            Under the <em>solidaire premieregeling</em> (SPR), the assets are{" "}
            <strong>not partitioned by cohort</strong>. The capital is invested as{" "}
            <strong>one collective portfolio</strong>. The period result is then
            distributed to participants via predetermined allocation rules (the{" "}
            <em>toedelingsregels</em>), split into a protection return and an
            excess return, with a solidarity reserve that fills in good years and
            drains in bad. Cohorts are a <strong>calculation overlay</strong> on a
            collective portfolio, never a physical split of the assets. The
            &ldquo;conversion&rdquo; this tool dramatises is{" "}
            <em>allocation</em> (collective → cohorts via rules), not a
            reconciliation between two parties&apos; cohort sets.
          </p>
        </Prose>

        <Prose title="The two returns">
          <p>
            <strong className="text-protection">Beschermingsrendement</strong>{" "}
            (protection return) is rate-driven and stabilising. In practice it is
            delivered either directly, via protection portfolios, or indirectly,
            via the DNB term structure. In this illustrative tool it is abstracted
            to a single knob; the methods are named for credibility, not
            separately simulated.
          </p>
          <p>
            <strong className="text-excess">Overrendement</strong> (excess return)
            comes from the return-seeking portfolio. It is the volatile part: drag
            market return down and the excess stream shrinks toward zero and then
            turns negative, hammering younger cohorts, who are allocated mostly
            excess, while pensioners (allocated mostly protection) stay roughly
            flat. That single frame is the reform&apos;s core logic.
          </p>
        </Prose>

        <Prose title="The solidarity reserve">
          <p>
            The <strong className="text-reserve">solidariteitsreserve</strong> is a
            buffer. A slice of excess bends into it in good years; it drains back
            to cushion cohorts, especially retirees, in bad years. Toggle{" "}
            <em>follow the reserve</em> to isolate only those flows, and watch the
            tank level respond to the scenario.
          </p>
        </Prose>

        <Prose title="1-year vs 5-year: an asymmetry worth teaching">
          <p>
            Going from one-year to five-year cohorts is plain summation:
            deterministic and lossless. Going the other way has{" "}
            <strong>no unique inverse</strong>: a five-year band can be split into
            single years by headcount, by capital, or uniformly, and the choice
            changes the per-year numbers. The tool refuses to fake it: switching
            to 1-year <em>stops and asks</em> which rule to apply, then marks the
            output with an &ldquo;assumption applied&rdquo; badge.
          </p>
        </Prose>

        <Prose title="How the illustrative model works">
          <p>For a single illustrative period, the engine computes:</p>
          <pre className="overflow-x-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-slate-100">
{`collectiveResult = f(marketReturn, rateChange)        // one collective portfolio
protectionReturn = g(rateChange, protectionLevel)      // rate-driven
excessReturn     = collectiveResult − protectionReturn // residual
reserveDelta     = h(excessReturn, reserveRules)       // fill good / drain bad

for each cohort c:
  creditedReturn[c] = W_protection[c]·protectionReturn
                    + W_excess[c]·(excess − reserveIn)
                    + reserveDraw[c]`}
          </pre>
          <p>
            <code>W_protection</code> and <code>W_excess</code> are the allocation
            matrix, the illustrative <em>toedelingsregels</em>. In Build mode you
            can edit them and the tool checks each row sums to 100%.
          </p>
        </Prose>

        <Prose title="What this is, and what it is not">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              It is an <strong>illustrative explainer</strong>. The numbers are
              didactic, not a calculation of any specific fund, and not advice.
            </li>
            <li>
              It is <strong>not</strong> an allocation engine, an ALM tool, or a
              calculation kernel.
            </li>
            <li>
              No real portfolio or participant data ever enters it. The standard
              is cohort-level; so is this, never participant-level.
            </li>
            <li>
              The allocation rules themselves are out of SIVI message scope; they are set
              by the fund/PUO and shared via policy documents.
            </li>
          </ul>
        </Prose>
      </article>

      <footer className="mx-auto mt-12 max-w-6xl px-4 text-xs text-ink-faint">
        <p>
          Illustrative model for explanation only. Not a calculation of any
          specific fund, and not advice. SPR-first; FPR lifecycles are a later
          tab.
        </p>
        <p className="mt-2">
          © WtpDataLab · Open-source, non-commercial ·{" "}
          <a
            href="https://github.com/WtpDataLab/spr-cohort-explainer"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted hover:no-underline"
          >
            Source &amp; license
          </a>
        </p>
      </footer>
    </main>
  );
}

function Prose({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}
