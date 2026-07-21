import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | The Cobalt Guide",
  description: "Why The Cobalt Guide exists and how the project stays open.",
};

const stack = ["Next.js", "TypeScript", "MapLibre", "Supabase", "PostGIS"];

export default function AboutPage() {
  return (
    <main className="flex-1 bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white">
      <header className="relative isolate overflow-hidden">
        <div
          className="surface-grid pointer-events-none absolute inset-0 -z-10 opacity-60"
          aria-hidden="true"
        />
        <div className="mx-auto flex min-h-[58svh] w-full max-w-6xl flex-col justify-end px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase dark:text-cobalt-300">
            About The Cobalt Guide
          </p>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-7xl lg:text-8xl">
            Know before you pay.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-600 sm:text-xl dark:text-zinc-300">
            Check reported merchant multipliers before you tap your card.
          </p>
        </div>
      </header>

      <section
        aria-labelledby="why-heading"
        className="bg-cobalt-50/70 dark:bg-cobalt-950/20"
      >
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase dark:text-cobalt-300">
            Why it exists
          </p>
          <h2
            id="why-heading"
            className="mt-7 max-w-4xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl"
          >
            Ever hesitate to ask, “Do you accept Amex?”
          </h2>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed tracking-[-0.015em] text-zinc-600 sm:text-2xl dark:text-zinc-300">
            Or discover after paying that your purchase didn&apos;t earn 5×
            Membership Rewards points?
          </p>
          <p className="mt-10 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            That&apos;s why The Cobalt Guide exists. If a location or earning
            rate looks wrong, help keep the guide accurate by{" "}
            <Link
              href="/submit"
              className="font-semibold text-cobalt-700 underline decoration-cobalt-300 underline-offset-4 transition-colors hover:text-cobalt-800 dark:text-cobalt-300 dark:hover:text-cobalt-200"
            >
              submitting a report
            </Link>
            .
          </p>
        </div>
      </section>

      <section
        aria-labelledby="technology-heading"
        className="bg-zinc-950 text-white"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-300 uppercase">
            Open by design
          </p>
          <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)] md:items-start md:gap-20">
            <h2
              id="technology-heading"
              className="max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl"
            >
              Want to know how your data is handled?
            </h2>
            <div className="max-w-lg">
              <p className="text-xl leading-8 text-zinc-100">
                Every line of the application is open for review.
              </p>
              <p className="mt-5 text-base leading-7 text-zinc-400">
                See how accounts, reports, permissions, and moderation work
                directly in the source.
              </p>
              <a
                href="https://github.com/carols12352/thecobaltguide"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-semibold text-zinc-950 transition-colors duration-200 hover:bg-cobalt-100"
              >
                Review the source
              </a>
            </div>
          </div>
          <div className="mt-16 flex flex-wrap gap-x-6 gap-y-3 text-xs text-zinc-500 sm:mt-20">
            {stack.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="contributors-heading">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase dark:text-zinc-400">
            Built by contributors
          </p>
          <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)] md:items-start md:gap-20">
            <h2
              id="contributors-heading"
              className="max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl"
            >
              See something wrong? Help fix it.
            </h2>
            <div className="max-w-lg">
              <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-300">
                Report missing locations, outdated earning rates, or incorrect
                merchant details. Each contribution makes the guide more useful
                for everyone.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/submit"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-cobalt-600 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-cobalt-700"
                >
                  Submit a report
                </Link>
                <Link
                  href="/map"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-100 px-5 text-sm font-semibold text-zinc-900 transition-colors duration-200 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                >
                  Open the map
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
