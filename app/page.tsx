import Link from "next/link";
import { HeroMapIllustration } from "@/components/map/hero-map-illustration";
import { MapPreview } from "@/components/map/map-preview";

const FEATURES = [
  ["Find", "Browse reported multipliers across Canadian merchants."],
  ["Check", "See recency and confidence before relying on a result."],
  ["Contribute", "Add missing places or help correct community data."],
] as const;

export default function HomePage() {
  return (
    <>
      <section
        data-home-section="hero"
        className="relative isolate min-h-[calc(100svh-4rem)] overflow-hidden border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(22rem,38%)_minmax(0,1fr)]">
          <div className="flex items-start px-4 pb-16 pt-[clamp(4.5rem,14vh,7.5rem)] sm:px-6 lg:justify-end lg:px-10 xl:px-14">
            <div className="hero-enter w-full max-w-[28rem]">
              <p className="text-sm font-semibold tracking-[0.15em] text-cobalt-700 uppercase dark:text-cobalt-300">
                The Cobalt Guide
              </p>
              <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] text-zinc-950 sm:text-5xl dark:text-white">
                Find where your Cobalt card goes further.
              </h1>
              <p className="mt-4 max-w-[26rem] text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8 dark:text-zinc-300">
                Community-reported merchant multipliers across Canada, with recency and confidence context.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="#map-preview"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-cobalt-600 px-5 text-sm font-semibold text-white shadow-sm transition-[background-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:bg-cobalt-700 hover:shadow-md active:translate-y-0 active:shadow-sm"
                >
                  Explore the map
                </Link>
                <Link
                  href="/submit"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 shadow-sm transition-[background-color,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-zinc-400 hover:bg-zinc-50 active:translate-y-0 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Add a merchant
                </Link>
              </div>
            </div>
          </div>

          <div className="hero-enter-delayed relative hidden min-h-0 border-l border-zinc-200 lg:block dark:border-zinc-800">
            <HeroMapIllustration />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent dark:from-zinc-950"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      <section
        id="map-preview"
        data-home-section="map"
        aria-labelledby="preview-heading"
        className="min-h-[calc(100svh-4rem)] scroll-mt-16 bg-zinc-50/80 dark:bg-zinc-900/40"
      >
        <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col px-4 py-10 sm:px-6 sm:py-12">
          <div className="mb-7 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase dark:text-cobalt-300">
                Quick lookup
              </p>
              <h2 id="preview-heading" className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
                Explore nearby reports
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Pan, zoom, or select a place for a quick look.
              </p>
            </div>
            <Link
              href="/map"
              className="group inline-flex items-center self-start rounded-md text-sm font-semibold text-cobalt-700 transition-colors duration-200 hover:text-cobalt-800 sm:self-auto dark:text-cobalt-300 dark:hover:text-cobalt-200"
            >
              Search and filter
              <span className="ml-2 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
          <MapPreview />
        </div>
      </section>

      <section
        data-home-section="about"
        aria-labelledby="features-heading"
        className="flex min-h-[calc(100svh-4rem)] items-center border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-8 border-b border-zinc-200 pb-12 md:grid-cols-[11rem_minmax(0,1fr)] dark:border-zinc-800">
            <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase dark:text-cobalt-300">
              How it works
            </p>
            <div>
              <h2
                id="features-heading"
                className="max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
              >
                Community reports, with enough context to judge them.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
                Compare multiplier, recency, purchase context, and confidence before deciding how much weight to give a result.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
            {FEATURES.map(([title, copy], index) => (
              <div
                key={title}
                className="border-t border-zinc-300 pt-5 transition-colors duration-200 hover:border-cobalt-500 dark:border-zinc-700"
              >
                <p className="font-mono text-xs text-cobalt-700 dark:text-cobalt-300">
                  0{index + 1}
                </p>
                <h3 className="mt-3 text-base font-semibold">{title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {copy}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-5 border-t border-zinc-200 pt-10 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Help keep the map current.</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Share a missing merchant or a recent multiplier result.
              </p>
            </div>
            <Link
              href="/submit"
              className="inline-flex h-10 items-center justify-center self-start rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold shadow-sm transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-zinc-400 hover:bg-zinc-50 active:translate-y-0 sm:self-auto dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Add a merchant
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
