import { isRewardsCanadaImported } from "@/lib/import/rewards-canada";
import { getSummaryCutoffDate } from "@/lib/summary/cutoff-date";
import { summaryRepository } from "@/server/repositories/summary-repository";
import { calculateAggregation } from "@/server/services/aggregation";

export class SummaryService {
  async refreshPlaceSummary(
    placeId: string,
    cardProductId: string,
  ): Promise<void> {
    const cutoffDate = getSummaryCutoffDate();
    const source = await summaryRepository.findAggregationSource(
      placeId,
      cardProductId,
      cutoffDate,
    );

    const importedFromRewardsCanada = isRewardsCanadaImported(
      source.externalPlaceId,
    );

    if (source.inputs.length === 0 && importedFromRewardsCanada) {
      return;
    }

    const result = calculateAggregation(source.inputs, new Date(), {
      importedFromRewardsCanada,
    });

    await summaryRepository.upsertPlaceSummary({
      placeId,
      cardProductId,
      currentMultiplier: result.currentMultiplier,
      confidenceScore: result.confidenceScore,
      confidenceLevel: result.confidenceLevel,
      recentReportCount: result.recentReportCount,
      uniqueReporterCount: result.uniqueReporterCount,
      lastReportedAt: result.lastReportedAt,
      score1x: result.score1x,
      score2x: result.score2x,
      score3x: result.score3x,
      score5x: result.score5x,
    });
  }
}

export const summaryService = new SummaryService();
