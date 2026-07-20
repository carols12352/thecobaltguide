import { createAdminClient } from "@/lib/supabase/admin";
import type { AggregationInput } from "@/types/domain";

export type SummaryReportRow = {
  multiplier: string;
  transaction_date: string;
  user_id: string;
  status: AggregationInput["status"];
};

export function projectAggregationInput(row: SummaryReportRow): AggregationInput {
  return {
    multiplier: parseInt(row.multiplier, 10) as AggregationInput["multiplier"],
    transactionDate: row.transaction_date,
    userId: row.user_id,
    status: row.status,
  };
}

export class SummaryRepository {
  async findAggregationSource(
    placeId: string,
    cardProductId: string,
    cutoffDate: string,
  ): Promise<{ externalPlaceId: string | null; inputs: AggregationInput[] }> {
    const supabase = createAdminClient();
    const [{ data: place, error: placeError }, { data: reports, error: reportsError }] =
      await Promise.all([
        supabase.from("places").select("external_place_id").eq("id", placeId).single(),
        supabase
          .from("multiplier_reports")
          .select("multiplier, transaction_date, user_id, status")
          .eq("place_id", placeId)
          .eq("card_product_id", cardProductId)
          .eq("status", "active")
          .gte("transaction_date", cutoffDate),
      ]);

    if (placeError) throw placeError;
    if (reportsError) throw reportsError;
    return {
      externalPlaceId: place?.external_place_id ?? null,
      inputs: ((reports ?? []) as SummaryReportRow[]).map(projectAggregationInput),
    };
  }

  async upsertPlaceSummary(values: {
    placeId: string;
    cardProductId: string;
    currentMultiplier: number | null;
    confidenceScore: number;
    confidenceLevel: string;
    recentReportCount: number;
    uniqueReporterCount: number;
    lastReportedAt: string | null;
    score1x: number;
    score2x: number;
    score3x: number;
    score5x: number;
  }): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from("place_multiplier_summaries").upsert({
      place_id: values.placeId,
      card_product_id: values.cardProductId,
      current_multiplier: values.currentMultiplier?.toString() ?? null,
      confidence_score: values.confidenceScore,
      confidence_level: values.confidenceLevel,
      recent_report_count: values.recentReportCount,
      unique_reporter_count: values.uniqueReporterCount,
      last_reported_at: values.lastReportedAt,
      score_1x: values.score1x,
      score_2x: values.score2x,
      score_3x: values.score3x,
      score_5x: values.score5x,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}

export const summaryRepository = new SummaryRepository();
