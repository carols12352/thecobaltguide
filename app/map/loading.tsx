export default function MapLoading() {
  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col bg-white dark:bg-zinc-950" aria-label="Loading map">
      <div className="border-b border-zinc-200 bg-zinc-50/80 px-4 py-5 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-3 h-7 w-72 max-w-full rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
        <div className="h-[65vh] animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </div>
  );
}
