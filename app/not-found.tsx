import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-20 sm:px-6">
      <p className="font-mono text-sm text-cobalt-700 dark:text-cobalt-300">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
        This page is not on the map.
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        The link may be outdated, or the merchant may no longer be available.
      </p>
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/map" className="text-cobalt-700 hover:underline dark:text-cobalt-300">
          Browse the map →
        </Link>
        <Link href="/" className="text-zinc-700 hover:underline dark:text-zinc-300">
          Return home
        </Link>
      </div>
    </div>
  );
}
