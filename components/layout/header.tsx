import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cobalt-600 text-sm text-white">
            5x
          </span>
          <span className="hidden sm:inline">Cobalt Merchant Map</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/submit"
            className="hidden text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 sm:inline"
          >
            Submit Report
          </Link>
          <Link
            href="/account"
            className="hidden text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 sm:inline"
          >
            Account
          </Link>
          <Link href="/submit">
            <Button size="sm">Report 5x</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
