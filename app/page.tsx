import Link from "next/link";
import { MapPreview } from "@/components/map/map-preview";

const FEATURES = [
  ["Find", "Browse reported multipliers across Canadian merchants."],
  ["Check", "See recency and confidence before relying on a result."],
  ["Contribute", "Add missing places or help correct community data."],
] as const;

export default function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="surface-grid pointer-events-none absolute inset-0 -z-10 opacity-70" aria-hidden="true" />
        <div className="mx-auto flex min-h-[30rem] max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-20">
          <div className="hero-enter max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.15em] text-cobalt-700 uppercase dark:text-cobalt-300">The Cobalt Guide</p>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.045em] text-zinc-950 sm:text-6xl dark:text-white">
              Find where your Cobalt card goes further.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              A community-maintained map of reported merchant multipliers across Canada.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/map" className="inline-flex h-11 items-center justify-center rounded-lg bg-cobalt-600 px-5 text-sm font-semibold text-white shadow-sm transition-[background-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:bg-cobalt-700 hover:shadow-md active:translate-y-0 active:shadow-sm">
                Open full map
              </Link>
              <Link href="/about" className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 shadow-sm transition-[background-color,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-zinc-400 hover:bg-zinc-50 active:translate-y-0 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
                About the guide
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="preview-heading" className="bg-zinc-50/70 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase dark:text-cobalt-300">Quick lookup</p>
              <h2 id="preview-heading" className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Explore nearby reports</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Pan, zoom, or select a place for a quick look.</p>
            </div>
            <Link href="/map" className="group inline-flex items-center self-start rounded-md text-sm font-semibold text-cobalt-700 transition-colors duration-200 hover:text-cobalt-800 sm:self-auto dark:text-cobalt-300 dark:hover:text-cobalt-200">
              Search and filter <span className="ml-2 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">→</span>
            </Link>
          </div>
          <MapPreview />
        </div>
      </section>

      <section aria-labelledby="features-heading" className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 id="features-heading" className="sr-only">What you can do</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {FEATURES.map(([title, copy], index) => (
              <div key={title} className="border-t border-zinc-300 pt-5 transition-colors duration-200 hover:border-cobalt-500 dark:border-zinc-700">
                <p className="font-mono text-xs text-cobalt-700 dark:text-cobalt-300">0{index + 1}</p>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">{copy}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-col gap-5 border-t border-zinc-200 pt-10 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Help keep the map current.</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Share a missing merchant or a recent multiplier result.</p>
            </div>
            <Link href="/submit" className="inline-flex h-10 items-center justify-center self-start rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold shadow-sm transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-zinc-400 hover:bg-zinc-50 active:translate-y-0 sm:self-auto dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">Add a merchant</Link>
          </div>
        </div>
      </section>
    </>
  );
}
