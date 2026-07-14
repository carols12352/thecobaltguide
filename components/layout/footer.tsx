import Link from "next/link";
import { REWARDS_CANADA_ATTRIBUTION } from "@/lib/import/rewards-canada";
import { BrandMark } from "@/components/brand/brand-mark";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-4 py-12 text-zinc-400 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-[1.4fr_.6fr_.6fr]">
        <div>
          <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
            <BrandMark className="h-7 w-7" />
            The Cobalt Guide
          </div>
          <p className="mt-3 max-w-md text-xs leading-5">
            Community-sourced reference data — card issuers may classify transactions differently.
          </p>
          <p className="mt-5 text-xs text-zinc-500">© 2026 The Cobalt Guide. Independent community project.</p>
        </div>
        <nav aria-label="Product links">
          <p className="text-xs font-semibold tracking-wide text-zinc-200 uppercase">Product</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link href="/map" className="rounded-sm transition-colors duration-200 hover:text-white">Explore map</Link></li>
            <li><Link href="/about" className="rounded-sm transition-colors duration-200 hover:text-white">About</Link></li>
            <li><Link href="/submit" className="rounded-sm transition-colors duration-200 hover:text-white">Add merchant</Link></li>
            <li><a href="https://github.com/carols12352/thecobaltguide" target="_blank" rel="noopener noreferrer" className="rounded-sm transition-colors duration-200 hover:text-white">GitHub <span aria-hidden="true">↗</span></a></li>
          </ul>
        </nav>
        <nav aria-label="Legal links">
          <p className="text-xs font-semibold tracking-wide text-zinc-200 uppercase">Legal</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link href="/privacy" className="rounded-sm transition-colors duration-200 hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/terms" className="rounded-sm transition-colors duration-200 hover:text-white">Terms of Service</Link></li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-zinc-800 pt-6">
        <p className="text-xs leading-5 text-zinc-500">
          {REWARDS_CANADA_ATTRIBUTION}{" "}
          <a href="https://www.rewardscanada.ca/cobaltmultipliers.html" className="rounded-sm underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-zinc-300" target="_blank" rel="noopener noreferrer">View original list</a>
        </p>
      </div>
    </footer>
  );
}
