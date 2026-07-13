import type { ReportKind } from "@/types/domain";

/** Users with reputation below this value cannot submit reports or flags. */
export const REPUTATION_SUBMIT_FLOOR = -10;

export const REPUTATION_DELTAS = {
  confirmSubmitted: 1,
  updateSubmitted: 1,
  confirmRemovedByModerator: -2,
  updateRemovedByModerator: -2,
  confirmSelfDeleted: -1,
  updateSelfDeleted: -1,
  errorApproved: 2,
  errorRejected: -2,
  newLocationApproved: 5,
  newLocationRejected: -3,
  flagResolved: 2,
  flagDismissed: -2,
} as const;

export const REPUTATION_HINT =
  "Reputation rewards accurate contributions. Confirms and updates earn +1 when submitted. Error reports earn +2 when upheld or lose 2 when rejected. New locations earn +5 when accepted or lose 3 when rejected. Place flags earn +2 when resolved or lose 2 when dismissed. You cannot submit reports or flags when reputation is below −10.";

export const REPUTATION_ADMIN_HINT =
  "Approve error reports (+2) and new locations (+5); remove invalid ones (−2 / −3). Removing confirms or updates costs the reporter 2. Resolve flags (+2) or dismiss invalid ones (−2). Admins can override reputation on the Users tab.";

export const REPUTATION_BLOCKED_MESSAGE =
  "Your reputation is too low to submit reports or flags. Improve it with accurate contributions or contact an admin.";

export function canSubmitWithReputation(reputationScore: number): boolean {
  return reputationScore >= REPUTATION_SUBMIT_FLOOR;
}

export function reputationDeltaForReportSubmission(reportKind: ReportKind): number {
  switch (reportKind) {
    case "confirm":
      return REPUTATION_DELTAS.confirmSubmitted;
    case "update":
      return REPUTATION_DELTAS.updateSubmitted;
    default:
      return 0;
  }
}

export function reputationDeltaForOwnReportDeletion(reportKind: ReportKind): number {
  switch (reportKind) {
    case "confirm":
      return REPUTATION_DELTAS.confirmSelfDeleted;
    case "update":
      return REPUTATION_DELTAS.updateSelfDeleted;
    default:
      return 0;
  }
}

export function reputationDeltaForReportApproval(reportKind: ReportKind): number {
  switch (reportKind) {
    case "error":
      return REPUTATION_DELTAS.errorApproved;
    case "new_location":
      return REPUTATION_DELTAS.newLocationApproved;
    default:
      return 0;
  }
}

export function reputationDeltaForModeratorReportRemoval(
  reportKind: ReportKind,
  previousStatus: string,
  nextStatus: string,
): number {
  if (nextStatus !== "removed" || previousStatus !== "active") return 0;

  switch (reportKind) {
    case "confirm":
      return REPUTATION_DELTAS.confirmRemovedByModerator;
    case "update":
      return REPUTATION_DELTAS.updateRemovedByModerator;
    case "error":
      return REPUTATION_DELTAS.errorRejected;
    case "new_location":
      return REPUTATION_DELTAS.newLocationRejected;
    default:
      return 0;
  }
}

export function reputationDeltaForFlagReview(
  previousStatus: string,
  nextStatus: string,
): number {
  if (previousStatus !== "open") return 0;

  if (nextStatus === "resolved") return REPUTATION_DELTAS.flagResolved;
  if (nextStatus === "dismissed") return REPUTATION_DELTAS.flagDismissed;
  return 0;
}
