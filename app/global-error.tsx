"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "global" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-svh items-center bg-zinc-50 px-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <main className="mx-auto w-full max-w-xl py-16">
          <p className="text-xs font-semibold tracking-[0.14em] text-red-700 uppercase dark:text-red-300">
            Application error
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            The Cobalt Guide needs to reload.
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            The problem has been recorded. Retry the application to continue.
          </p>
          <button
            type="button"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-cobalt-600 px-5 text-sm font-semibold text-white hover:bg-cobalt-700"
            onClick={() => unstable_retry()}
          >
            Retry application
          </button>
        </main>
      </body>
    </html>
  );
}
