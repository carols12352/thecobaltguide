import Link from "next/link";
import { HeroMapIllustration } from "@/components/map/hero-map-illustration";
import { MapPreview } from "@/components/map/map-preview";

const FEATURES = [
  ["Find", "Browse nearby merchants."],
  ["Check", "See multiplier, recency, and confidence."],
  ["Contribute", "Add or correct a place."],
] as const;

export default function HomePage() {
  return (
    <>
      <section
        data-home-section="hero"
        className="relative isolate min-h-[calc(100svh-4rem)] overflow-hidden border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="grid min-h-[calc(100svh-4rem)] grid-rows-[auto_minmax(18rem,1fr)] lg:grid-cols-[minmax(28rem,44%)_minmax(0,1fr)] lg:grid-rows-1">
          <div className="flex items-center px-4 py-14 sm:px-6 sm:py-16 lg:justify-end lg:px-12 xl:px-16">
            <div className="hero-enter w-full max-w-[34rem]">
              <p className="text-sm font-semibold tracking-[0.15em] text-cobalt-700 uppercase dark:text-cobalt-300">
                The Cobalt Guide
              </p>
              <h1 className="mt-5 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-zinc-950 sm:text-6xl lg:text-[clamp(3.75rem,5vw,5rem)] dark:text-white">
                Find where your Cobalt card goes further.
              </h1>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/map"
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

          <div className="hero-enter-delayed relative min-h-0 overflow-hidden border-t border-zinc-200 lg:border-l lg:border-t-0 dark:border-zinc-800">
            <HeroMapIllustration />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-white to-transparent lg:block dark:from-zinc-950"
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
          <div className="mb-6 flex shrink-0 items-end justify-between gap-6 border-b border-zinc-200 pb-6 dark:border-zinc-800">
            <div className="min-w-0">
              <h2 id="preview-heading" className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Explore the map
              </h2>
            </div>
            <Link
              href="/map"
              className="inline-flex shrink-0 items-center rounded-md text-sm font-semibold text-cobalt-700 transition-colors duration-200 hover:text-cobalt-800 dark:text-cobalt-300 dark:hover:text-cobalt-200"
            >
              Search and filter
            </Link>
          </div>
          <MapPreview />
        </div>
      </section>

      <section
        data-home-section="about"
        aria-labelledby="features-heading"
        className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="flex flex-col gap-5 border-b border-zinc-200 pb-12 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800">
            <h2
              id="features-heading"
              className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl"
            >
              How it works
            </h2>
            <Link
              href="/submit"
              className="inline-flex h-10 items-center justify-center self-start rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold shadow-sm transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-zinc-400 hover:bg-zinc-50 active:translate-y-0 sm:self-auto dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Add a merchant
            </Link>
          </div>

          <div className="grid md:grid-cols-3">
            {FEATURES.map(([title, copy], index) => (
              <div
                key={title}
                className="border-b border-zinc-200 py-8 transition-colors duration-200 hover:border-cobalt-500 md:border-r md:px-8 md:py-10 md:first:pl-0 md:last:border-r-0 md:last:pr-0 dark:border-zinc-800"
              >
                <p className="font-mono text-xs text-cobalt-700 dark:text-cobalt-300">
                  0{index + 1}
                </p>
                <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {copy}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>
    </>
  );
}
