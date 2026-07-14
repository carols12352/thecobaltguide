import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | The Cobalt Guide",
  description: "Why The Cobalt Guide exists and how its community merchant data works.",
};

const CAPABILITIES = [
  ["Find", "Search nearby merchants by category or reported multiplier."],
  ["Assess", "Check recency, purchase context, and confidence before relying on a result."],
  ["Correct", "Add missing places, share outcomes, or flag information for review."],
] as const;

export default function AboutPage() {
  return (
    <div className="flex-1 bg-white dark:bg-zinc-950">
      <header className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="surface-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase dark:text-cobalt-300">About</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
            Community reports, with useful context.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
            The Cobalt Guide is an independent, open-source map of reported merchant multipliers across Canada.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-18">
        <section aria-labelledby="why-heading" className="grid gap-8 md:grid-cols-[12rem_minmax(0,1fr)]">
          <h2 id="why-heading" className="text-sm font-semibold text-zinc-950 dark:text-white">Why it exists</h2>
          <div className="max-w-2xl space-y-4 text-base leading-7 text-zinc-600 dark:text-zinc-300">
            <p>Merchant coding can vary by location, payment channel, and issuer classification. A storefront name alone rarely tells the whole story.</p>
            <p>This project makes community reports easier to find and judge. It provides evidence, not a guaranteed earning rate.</p>
          </div>
        </section>

        <section aria-labelledby="capabilities-heading" className="mt-16 border-t border-zinc-200 pt-16 dark:border-zinc-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="capabilities-heading" className="text-3xl font-semibold tracking-[-0.035em]">How it works</h2>
            <p className="text-sm text-zinc-500">Find → assess → improve</p>
          </div>
          <div className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {CAPABILITIES.map(([title, copy], index) => (
              <div key={title} className="grid gap-3 py-6 sm:grid-cols-[3rem_10rem_1fr] sm:items-start">
                <span className="font-mono text-xs text-cobalt-700 dark:text-cobalt-300">0{index + 1}</span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="technology-heading" className="mt-16 grid gap-8 border-t border-zinc-200 pt-16 md:grid-cols-[12rem_minmax(0,1fr)] dark:border-zinc-800">
          <div>
            <h2 id="technology-heading" className="text-sm font-semibold">Open by design</h2>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Source and decisions are visible to the community.</p>
          </div>
          <div>
            <p className="max-w-2xl leading-7 text-zinc-600 dark:text-zinc-300">Built with Next.js, TypeScript, MapLibre, Supabase, PostgreSQL, and PostGIS. Moderation, validation, access controls, and rate limits help keep contributions useful.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              {["Next.js", "TypeScript", "MapLibre", "Supabase", "PostGIS"].map((item) => <span key={item} className="rounded-md border border-zinc-200 px-2.5 py-1.5 dark:border-zinc-800">{item}</span>)}
            </div>
            <a href="https://github.com/carols12352/thecobaltguide" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex text-sm font-semibold text-cobalt-700 transition-colors duration-200 hover:text-cobalt-800 dark:text-cobalt-300 dark:hover:text-cobalt-200">View source on GitHub <span className="ml-2" aria-hidden="true">↗</span></a>
          </div>
        </section>

        <section className="mt-16 flex flex-col gap-5 rounded-2xl bg-cobalt-50 p-7 sm:flex-row sm:items-center sm:justify-between dark:bg-cobalt-950/20">
          <div><h2 className="text-xl font-semibold">Built by its contributors.</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Browse the map or add a missing place.</p></div>
          <Link href="/map" className="inline-flex h-10 items-center justify-center self-start rounded-lg bg-cobalt-600 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-cobalt-700 sm:self-auto">Open the map</Link>
        </section>
      </div>
    </div>
  );
}
