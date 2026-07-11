import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CreateReportInput } from "@/server/validation/schemas";
import type { MultiplierReport } from "@/types/domain";

export class ReportRepository {
  async findByPlaceId(placeId: string, limit = 20): Promise<MultiplierReport[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("multiplier_reports")
      .select("*")
      .eq("place_id", placeId)
      .eq("status", "active")
      .order("transaction_date", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(this.mapReport);
  }

  async findByUserId(userId: string): Promise<MultiplierReport[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("multiplier_reports")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(this.mapReport);
  }

  async create(
    placeId: string,
    userId: string,
    cardProductId: string,
    input: CreateReportInput,
  ) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("multiplier_reports")
      .insert({
        place_id: placeId,
        user_id: userId,
        card_product_id: cardProductId,
        multiplier: input.multiplier.toString(),
        transaction_date: input.transactionDate,
        payment_context: input.paymentContext,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return this.mapReport(data);
  }

  async softDelete(reportId: string, userId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("multiplier_reports")
      .update({ status: "removed", updated_at: new Date().toISOString() })
      .eq("id", reportId)
      .eq("user_id", userId)
      .eq("status", "active")
      .select("*")
      .single();

    if (error) throw error;
    return this.mapReport(data);
  }

  async adminUpdateStatus(
    reportId: string,
    status: "active" | "removed" | "flagged",
    moderationReason?: string,
  ) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("multiplier_reports")
      .update({
        status,
        moderation_reason: moderationReason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .select("*")
      .single();

    if (error) throw error;
    return this.mapReport(data);
  }

  async findRecentForAdmin(limit = 50) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("multiplier_reports")
      .select("*, places ( name ), profiles ( username )")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  private mapReport(row: Record<string, unknown>): MultiplierReport {
    return {
      id: row.id as string,
      placeId: row.place_id as string,
      userId: row.user_id as string,
      cardProductId: row.card_product_id as string,
      multiplier: parseInt(row.multiplier as string, 10) as MultiplierReport["multiplier"],
      transactionDate: row.transaction_date as string,
      paymentContext: row.payment_context as MultiplierReport["paymentContext"],
      notes: row.notes as string | null,
      status: row.status as MultiplierReport["status"],
      createdAt: row.created_at as string,
    };
  }
}

export const reportRepository = new ReportRepository();
