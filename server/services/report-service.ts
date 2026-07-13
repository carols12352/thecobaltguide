import { placeRepository } from "@/server/repositories/place-repository";
import { reportRepository } from "@/server/repositories/report-repository";
import { invalidateAdminCaches } from "@/lib/cache/admin-cache";
import { invalidatePlaceReadCaches } from "@/lib/cache/place-cache";
import { summaryService } from "@/server/services/summary-service";
import type { CreateReportInput } from "@/server/validation/schemas";
import type { ReportKind } from "@/types/domain";

export class ReportService {
  async getReportsForPlace(placeId: string) {
    return reportRepository.findByPlaceId(placeId);
  }

  async getReportsForUser(userId: string) {
    return reportRepository.findByUserId(userId);
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

    const report = await reportRepository.create(
      placeId,
      userId,
      cardProductId,
      input,
      reportKind,
    );

    await summaryService.refreshPlaceSummary(placeId, cardProductId);
    await invalidatePlaceReadCaches(placeId);
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
    const report = await reportRepository.softDelete(reportId, userId);
    await summaryService.refreshPlaceSummary(report.placeId, report.cardProductId);
    await invalidatePlaceReadCaches(report.placeId);
    await invalidateAdminCaches();

    return report;
  }
}

export const reportService = new ReportService();
