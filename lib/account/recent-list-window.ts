/** Account page lists only include items from this many days. */
export const ACCOUNT_RECENT_LIST_DAYS = 30;

/** ISO timestamp for `created_at >= now - days` filters. */
export function accountListSinceIso(
  days: number = ACCOUNT_RECENT_LIST_DAYS,
  now: Date = new Date(),
): string {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - days);
  return since.toISOString();
}
