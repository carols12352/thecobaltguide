import { describe, expect, it } from "vitest";
import {
  canSubmitWithReputation,
  REPUTATION_DELTAS,
  REPUTATION_SUBMIT_FLOOR,
  reputationDeltaForFlagReview,
  reputationDeltaForModeratorReportRemoval,
  reputationDeltaForOwnReportDeletion,
  reputationDeltaForReportApproval,
  reputationDeltaForReportSubmission,
} from "@/lib/reputation/scoring";

describe("canSubmitWithReputation", () => {
  it("allows submission at the floor and blocks below it", () => {
    expect(canSubmitWithReputation(REPUTATION_SUBMIT_FLOOR)).toBe(true);
    expect(canSubmitWithReputation(REPUTATION_SUBMIT_FLOOR - 1)).toBe(false);
    expect(canSubmitWithReputation(0)).toBe(true);
  });
});

describe("reputationDeltaForReportSubmission", () => {
  it("awards points for auto-approved confirm and update reports", () => {
    expect(reputationDeltaForReportSubmission("confirm")).toBe(
      REPUTATION_DELTAS.confirmSubmitted,
    );
    expect(reputationDeltaForReportSubmission("update")).toBe(
      REPUTATION_DELTAS.updateSubmitted,
    );
    expect(reputationDeltaForReportSubmission("error")).toBe(0);
  });
});

describe("reputationDeltaForReportApproval", () => {
  it("awards reviewed report types when staff approve them", () => {
    expect(reputationDeltaForReportApproval("error")).toBe(
      REPUTATION_DELTAS.errorApproved,
    );
    expect(reputationDeltaForReportApproval("new_location")).toBe(
      REPUTATION_DELTAS.newLocationApproved,
    );
    expect(reputationDeltaForReportApproval("confirm")).toBe(0);
  });
});

describe("reputationDeltaForOwnReportDeletion", () => {
  it("reverses submit bonuses for confirm and update reports", () => {
    expect(reputationDeltaForOwnReportDeletion("confirm")).toBe(
      REPUTATION_DELTAS.confirmSelfDeleted,
    );
    expect(reputationDeltaForOwnReportDeletion("update")).toBe(
      REPUTATION_DELTAS.updateSelfDeleted,
    );
    expect(reputationDeltaForOwnReportDeletion("error")).toBe(0);
  });
});

describe("reputationDeltaForModeratorReportRemoval", () => {
  it("penalizes invalid active reports removed by staff", () => {
    expect(
      reputationDeltaForModeratorReportRemoval("confirm", "active", "removed"),
    ).toBe(REPUTATION_DELTAS.confirmRemovedByModerator);
    expect(
      reputationDeltaForModeratorReportRemoval("update", "active", "removed"),
    ).toBe(REPUTATION_DELTAS.updateRemovedByModerator);
    expect(
      reputationDeltaForModeratorReportRemoval("error", "active", "removed"),
    ).toBe(REPUTATION_DELTAS.errorRejected);
    expect(
      reputationDeltaForModeratorReportRemoval(
        "new_location",
        "active",
        "removed",
      ),
    ).toBe(REPUTATION_DELTAS.newLocationRejected);
  });

  it("ignores non-removal transitions", () => {
    expect(
      reputationDeltaForModeratorReportRemoval("confirm", "flagged", "removed"),
    ).toBe(0);
    expect(
      reputationDeltaForModeratorReportRemoval("confirm", "active", "active"),
    ).toBe(0);
  });
});

describe("reputationDeltaForFlagReview", () => {
  it("awards or penalizes flag submitters after staff review", () => {
    expect(reputationDeltaForFlagReview("open", "resolved")).toBe(
      REPUTATION_DELTAS.flagResolved,
    );
    expect(reputationDeltaForFlagReview("open", "dismissed")).toBe(
      REPUTATION_DELTAS.flagDismissed,
    );
    expect(reputationDeltaForFlagReview("resolved", "dismissed")).toBe(0);
  });
});
