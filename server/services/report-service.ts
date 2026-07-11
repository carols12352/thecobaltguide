import { placeRepository } from "@/server/repositories/place-repository";
import { reportRepository } from "@/server/repositories/report-repository";
import { invalidatePlaceReadCaches } from "@/lib/cache/place-cache";
import { summaryService } from "@/server/services/summary-service";
import type { CreateReportInput } from "@/server/validation/schemas";

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

    const report = await reportRepository.create(
      placeId,
      userId,
      cardProductId,
      input,
    );

    await summaryService.refreshPlaceSummary(placeId, cardProductId);
    await invalidatePlaceReadCaches(placeId);

    return report;
  }

  async deleteOwnReport(reportId: string, userId: string) {
    const report = await reportRepository.softDelete(reportId, userId);
    await summaryService.refreshPlaceSummary(report.placeId, report.cardProductId);
    await invalidatePlaceReadCaches(report.placeId);

    return report;
  }
}

export const reportService = new ReportService();
