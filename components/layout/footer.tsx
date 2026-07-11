import { REWARDS_CANADA_ATTRIBUTION } from "@/lib/import/rewards-canada";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
      <p>
        Community-sourced reference data — card issuers may classify transactions
        differently.
      </p>
      <p className="mt-1">
        {REWARDS_CANADA_ATTRIBUTION}{" "}
        <a
          href="https://www.rewardscanada.ca/cobaltmultipliers.html"
          className="underline hover:text-zinc-700"
          target="_blank"
          rel="noopener noreferrer"
        >
          View original list
        </a>
      </p>
    </footer>
  );
}
