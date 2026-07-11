import { createAdminClient } from "@/lib/supabase/admin";
import { isRewardsCanadaImported } from "@/lib/import/rewards-canada";
import { calculateAggregation } from "@/server/services/aggregation";
import type { AggregationInput } from "@/types/domain";

export class SummaryService {
  async refreshPlaceSummary(
    placeId: string,
    cardProductId: string,
  ): Promise<void> {
    const supabase = createAdminClient();

    const [{ data: place }, { data: reports, error }] = await Promise.all([
      supabase.from("places").select("external_place_id").eq("id", placeId).single(),
      supabase
        .from("multiplier_reports")
        .select("multiplier, transaction_date, user_id, status")
        .eq("place_id", placeId)
        .eq("card_product_id", cardProductId),
    ]);

    if (error) throw error;

    const importedFromRewardsCanada = isRewardsCanadaImported(
      place?.external_place_id,
    );

    const inputs: AggregationInput[] = (reports ?? []).map((r) => ({
      multiplier: parseInt(r.multiplier, 10) as AggregationInput["multiplier"],
      transactionDate: r.transaction_date,
      userId: r.user_id,
      status: r.status,
    }));

    if (inputs.length === 0 && importedFromRewardsCanada) {
      return;
    }

    const result = calculateAggregation(inputs, new Date(), {
      importedFromRewardsCanada,
    });

    const { error: upsertError } = await supabase
      .from("place_multiplier_summaries")
      .upsert({
        place_id: placeId,
        card_product_id: cardProductId,
        current_multiplier: result.currentMultiplier?.toString() ?? null,
        confidence_score: result.confidenceScore,
        confidence_level: result.confidenceLevel,
        recent_report_count: result.recentReportCount,
        unique_reporter_count: result.uniqueReporterCount,
        last_reported_at: result.lastReportedAt,
        score_1x: result.score1x,
        score_2x: result.score2x,
        score_3x: result.score3x,
        score_5x: result.score5x,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) throw upsertError;
  }
}

export const summaryService = new SummaryService();
