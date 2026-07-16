export const REWARDS_CANADA_ATTRIBUTION =
  "Merchant multiplier data initially sourced from Rewards Canada community list (rewardscanada.ca).";

export const REWARDS_CANADA_EXTERNAL_PREFIX = "rewards-canada:";

export function isRewardsCanadaImported(
  externalPlaceId: string | null | undefined,
): boolean {
  return (
    typeof externalPlaceId === "string"
    && externalPlaceId.startsWith(REWARDS_CANADA_EXTERNAL_PREFIX)
  );
}
