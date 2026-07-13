import { reportKindNeedsReview } from "@/lib/reports/report-kind";
import type { MultiplierReport } from "@/types/domain";

export type UserReportListView = "active" | "archive";

export type UserOwnedReport = MultiplierReport & {
  reviewedAt: string | null;
  reviewedBy: string | null;
};

/** Reports still live on the map and not yet closed out by staff review. */
export function isActiveUserReport(report: UserOwnedReport): boolean {
  return report.status === "active" && !report.reviewedBy;
}

/** Moderated, flagged, removed, or staff-reviewed reports. */
export function isArchivedUserReport(report: UserOwnedReport): boolean {
  return (
    report.status === "removed" ||
    report.status === "flagged" ||
    Boolean(report.reviewedBy)
  );
}

/** Only pending review reports can still be withdrawn by the reporter. */
export function canUserRemoveReport(report: UserOwnedReport): boolean {
  if (report.status !== "active") return false;
  if (report.reviewedBy) return false;
  if (!reportKindNeedsReview(report.reportKind)) return false;
  return !report.reviewedAt;
}

export function userReportStatusLabel(report: UserOwnedReport): string {
  if (report.status === "removed") return "Removed";
  if (report.status === "flagged") return "Flagged";
  if (report.reviewedBy) return "Reviewed";
  if (reportKindNeedsReview(report.reportKind) && !report.reviewedAt) {
    return "Pending review";
  }
  return "Active";
}

export const ACCOUNT_REPORTS_PAGE_SIZE = 5;
