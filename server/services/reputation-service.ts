import {
  canSubmitWithReputation,
  REPUTATION_BLOCKED_MESSAGE,
  reputationDeltaForFlagReview,
  reputationDeltaForModeratorReportRemoval,
  reputationDeltaForOwnReportDeletion,
  reputationDeltaForReportApproval,
  reputationDeltaForReportSubmission,
} from "@/lib/reputation/scoring";
import { userRepository } from "@/server/repositories/flag-repository";
import type { ReportKind } from "@/types/domain";

export class ReputationBlockedError extends Error {
  constructor(message = REPUTATION_BLOCKED_MESSAGE) {
    super(message);
    this.name = "ReputationBlockedError";
  }
}

export class ReputationService {
  async assertCanSubmit(userId: string): Promise<void> {
    const score = await userRepository.getReputationScore(userId);
    if (!canSubmitWithReputation(score)) {
      throw new ReputationBlockedError();
    }
  }

  async onReportSubmitted(userId: string, reportKind: ReportKind): Promise<void> {
    await userRepository.adjustReportCount(userId, 1);
    const delta = reputationDeltaForReportSubmission(reportKind);
    if (delta !== 0) {
      await userRepository.adjustReputationScore(userId, delta);
    }
  }

  async onOwnReportDeleted(userId: string, reportKind: ReportKind): Promise<void> {
    await userRepository.adjustReportCount(userId, -1);
    const delta = reputationDeltaForOwnReportDeletion(reportKind);
    if (delta !== 0) {
      await userRepository.adjustReputationScore(userId, delta);
    }
  }

  async onReportApproved(userId: string, reportKind: ReportKind): Promise<void> {
    const delta = reputationDeltaForReportApproval(reportKind);
    if (delta !== 0) {
      await userRepository.adjustReputationScore(userId, delta);
    }
  }

  async onModeratorReportStatusChange(
    reporterUserId: string,
    reportKind: ReportKind,
    previousStatus: string,
    nextStatus: string,
  ): Promise<void> {
    const delta = reputationDeltaForModeratorReportRemoval(
      reportKind,
      previousStatus,
      nextStatus,
    );
    if (delta !== 0) {
      await userRepository.adjustReputationScore(reporterUserId, delta);
    }
  }

  async onFlagSubmitted(userId: string): Promise<void> {
    await this.assertCanSubmit(userId);
  }

  async onFlagReviewed(
    reporterUserId: string,
    previousStatus: string,
    nextStatus: string,
  ): Promise<void> {
    const delta = reputationDeltaForFlagReview(previousStatus, nextStatus);
    if (delta !== 0) {
      await userRepository.adjustReputationScore(reporterUserId, delta);
    }
  }
}

export const reputationService = new ReputationService();
