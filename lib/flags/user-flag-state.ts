import type { FlagReason, FlagStatus } from "@/types/domain";

export type UserFlagListView = "active" | "archive";

export const ACCOUNT_FLAGS_PAGE_SIZE = 5;

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  duplicate: "Duplicate",
  wrong_address: "Wrong address",
  permanently_closed: "Permanently closed",
  does_not_accept_amex: "Does not accept Amex",
  incorrect_category: "Incorrect category",
  other: "Other",
};

export function isActiveUserFlag(flag: { status: FlagStatus }): boolean {
  return flag.status === "open";
}

export function isArchivedUserFlag(flag: { status: FlagStatus }): boolean {
  return flag.status === "resolved" || flag.status === "dismissed";
}

export function userFlagStatusLabel(flag: { status: FlagStatus }): string {
  if (flag.status === "open") return "Open";
  if (flag.status === "resolved") return "Resolved";
  return "Dismissed";
}
