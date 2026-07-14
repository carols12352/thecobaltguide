import Link from "next/link";

export interface LegalSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  summary: string;
  effectiveDate: string;
  sections: LegalSection[];
}

export function LegalPage({
  eyebrow,
  title,
  summary,
  effectiveDate,
  sections,
}: LegalPageProps) {
  return (
    <div className="flex-1 bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-18">
          <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase dark:text-cobalt-300">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
            {summary}
          </p>
          <p className="mt-5 text-xs font-medium text-zinc-500">
            Effective {effectiveDate}
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-12 px-4 py-12 sm:px-6 md:grid-cols-[13rem_minmax(0,1fr)] md:py-16">
        <aside>
          <nav aria-label={`${title} sections`} className="md:sticky md:top-24">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              On this page
            </p>
            <ol className="mt-4 space-y-2 border-l border-zinc-200 pl-4 text-sm dark:border-zinc-800">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="rounded-sm text-zinc-600 transition-colors hover:text-cobalt-700 dark:text-zinc-400 dark:hover:text-cobalt-300"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className={index === 0 ? "scroll-mt-24" : "mt-12 scroll-mt-24 border-t border-zinc-200 pt-12 dark:border-zinc-800"}
            >
              <h2 className="text-xl font-semibold tracking-tight">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-[0.9375rem] leading-7 text-zinc-600 dark:text-zinc-300">
                {section.content}
              </div>
            </section>
          ))}

          <div className="mt-14 border-t border-zinc-200 pt-8 dark:border-zinc-800">
            <Link
              href="/"
              className="inline-flex items-center text-sm font-semibold text-cobalt-700 hover:text-cobalt-800 dark:text-cobalt-300 dark:hover:text-cobalt-200"
            >
              <span className="mr-2" aria-hidden="true">←</span> Back to the guide
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
