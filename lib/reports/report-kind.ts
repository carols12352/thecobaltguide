import type { ReportKind } from "@/types/domain";

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  new_location: "New location",
  error: "Error report",
  update: "Multiplier update",
  confirm: "Multiplier confirm",
};

export function reportKindNeedsReview(kind: ReportKind): boolean {
  return kind === "new_location" || kind === "error";
}
