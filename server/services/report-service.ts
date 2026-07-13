import { placeRepository } from "@/server/repositories/place-repository";
import { reportRepository } from "@/server/repositories/report-repository";
import { canUserRemoveReport } from "@/lib/reports/user-report-state";
import { groupPlaceReports } from "@/lib/reports/place-report-groups";
import { RATE_LIMITS } from "@/config/constants";
import { invalidateAdminCaches } from "@/lib/cache/admin-cache";
import { invalidatePlaceReadCaches } from "@/lib/cache/place-cache";
import {
  getCachedUserAccountReports,
  invalidateUserAccountCaches,
  setCachedUserAccountReports,
} from "@/lib/cache/user-account-cache";
import { summaryService } from "@/server/services/summary-service";
import { reputationService } from "@/server/services/reputation-service";
import { ReportPlaceDailyLimitError } from "@/server/services/report-errors";
import type { CreateReportInput } from "@/server/validation/schemas";
import type { ReportKind } from "@/types/domain";

type UserReportsListOptions = {
  view?: "active" | "archive";
  page?: number;
  pageSize?: number;
};

export class ReportService {
  async getReportsForPlace(placeId: string) {
    return reportRepository.findByPlaceId(placeId);
  }

  async getGroupedReportsForPlace(placeId: string) {
    const reports = await reportRepository.findByPlaceId(placeId);
    return {
      groups: groupPlaceReports(reports),
      totalReports: reports.length,
    };
  }

  async getReportsForUser(userId: string, options: UserReportsListOptions = {}) {
    const view = options.view ?? "active";
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 5;
    const cacheParams = { view, page, pageSize };

    const cached = await getCachedUserAccountReports<
      Awaited<ReturnType<typeof reportRepository.findByUserId>>
    >(userId, cacheParams);
    if (cached) return cached;

    const result = await reportRepository.findByUserId(userId, options);
    await setCachedUserAccountReports(userId, cacheParams, result);
    return result;
  }

  async submitReport(
    placeId: string,
    userId: string,
    input: CreateReportInput,
  ) {
    const cardProductId =
      input.cardProductId ?? (await placeRepository.getDefaultCardProductId());
    const reportKind = await this.classifyReportKind(
      placeId,
      cardProductId,
      input,
    );

    await reputationService.assertCanSubmit(userId);

    if (RATE_LIMITS.oneReportPerPlacePerDay) {
      const alreadyReported = await reportRepository.hasUserReportedPlaceToday(
        userId,
        placeId,
      );
      if (alreadyReported) {
        throw new ReportPlaceDailyLimitError();
      }
    }

    const report = await reportRepository.create(
      placeId,
      userId,
      cardProductId,
      input,
      reportKind,
    );

    await reputationService.onReportSubmitted(userId, reportKind);

    await summaryService.refreshPlaceSummary(placeId, cardProductId);
    await invalidatePlaceReadCaches(placeId);
    await invalidateUserAccountCaches(userId);
    if (reportKind === "new_location" || reportKind === "error") {
      await invalidateAdminCaches();
    }

    return report;
  }

  private async classifyReportKind(
    placeId: string,
    cardProductId: string,
    input: CreateReportInput,
  ): Promise<ReportKind> {
    if (input.intent === "error") {
      return "error";
    }

    const [placeMeta, activeReportCount, summary] = await Promise.all([
      placeRepository.findReportClassificationMeta(placeId),
      reportRepository.countActiveByPlace(placeId),
      placeRepository.findSummaryMultiplier(placeId, cardProductId),
    ]);

    if (!placeMeta) {
      return "update";
    }

    const isFirstUserSubmittedReport =
      placeMeta.createdBy !== null && activeReportCount === 0;
    if (isFirstUserSubmittedReport) {
      return "new_location";
    }

    if (
      summary?.currentMultiplier != null &&
      summary.currentMultiplier === input.multiplier
    ) {
      return "confirm";
    }

    return "update";
  }

  async deleteOwnReport(reportId: string, userId: string) {
    const existing = await reportRepository.findById(reportId);
    if (!existing || existing.userId !== userId || existing.status !== "active") {
      throw new Error("Report not found");
    }
    if (!canUserRemoveReport({
      ...existing,
      reviewedAt: existing.reviewedAt ?? null,
      reviewedBy: existing.reviewedBy ?? null,
    })) {
      throw new Error("Report cannot be removed");
    }

    const report = await reportRepository.softDelete(reportId, userId);
    await reputationService.onOwnReportDeleted(userId, existing.reportKind);
    await summaryService.refreshPlaceSummary(report.placeId, report.cardProductId);
    await invalidatePlaceReadCaches(report.placeId);
    await invalidateUserAccountCaches(userId);
    await invalidateAdminCaches();

    return report;
  }
}

export const reportService = new ReportService();
