import { RECENCY_WEIGHTS } from "@/config/constants";

/** ISO date (YYYY-MM-DD) for the oldest transaction_date included in aggregation. */
export function getSummaryCutoffDate(now: Date = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENCY_WEIGHTS.excludeAfterDays);
  return cutoff.toISOString().slice(0, 10);
}
