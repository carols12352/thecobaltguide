"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "app" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-20 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.14em] text-red-700 uppercase dark:text-red-300">
        Something went wrong
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
        This page could not be loaded.
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        The problem has been recorded. Try loading the page again, or return to
        the map.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={() => unstable_retry()}>
          Try again
        </Button>
        <Link href="/map">
          <Button variant="outline">Open map</Button>
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-6 font-mono text-xs text-zinc-500">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
