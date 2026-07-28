import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/brand-mark";
import { AdminHeaderLink } from "@/components/layout/admin-header-link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/88 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/88">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          aria-label="The Cobalt Guide home"
          className="group flex items-center gap-2.5 rounded-lg font-semibold tracking-tight"
        >
          <BrandMark className="h-8 w-8 drop-shadow-sm transition-transform duration-200 group-hover:-rotate-1" />
          <span className="hidden sm:inline">The Cobalt Guide</span>
        </Link>

        <nav aria-label="Primary navigation" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/map"
            className="hidden rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 sm:inline-flex dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            Map
          </Link>
          <Link
            href="/about"
            className="hidden rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 md:inline-flex dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            About
          </Link>
          <AdminHeaderLink />
          <Link
            href="/account"
            className="rounded-lg px-2 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 sm:px-3 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Account
          </Link>
          <Link
            href="/submit"
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-lg bg-cobalt-600 px-3 text-sm font-medium text-white shadow-sm transition-[background-color,transform,box-shadow] hover:-translate-y-px hover:bg-cobalt-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500 focus-visible:ring-offset-2 active:translate-y-0",
            )}
          >
            Add Merchant
          </Link>
        </nav>
      </div>
    </header>
  );
}
