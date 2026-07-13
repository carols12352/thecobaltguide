import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CreateReportInput } from "@/server/validation/schemas";
import type { MultiplierReport, ReportKind } from "@/types/domain";
import { reportKindNeedsReview } from "@/lib/reports/report-kind";

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

  async findByUserId(userId: string, limit = 50): Promise<MultiplierReport[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("multiplier_reports")
      .select(
        "id, place_id, user_id, card_product_id, multiplier, transaction_date, payment_context, notes, status, report_kind, reviewed_at, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(this.mapReport);
  }

  async countActiveByPlace(placeId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("multiplier_reports")
      .select("id")
      .eq("place_id", placeId)
      .eq("status", "active")
      .limit(1);

    if (error) throw error;
    return data?.length ?? 0;
  }

  async create(
    placeId: string,
    userId: string,
    cardProductId: string,
    input: CreateReportInput,
    reportKind: ReportKind,
  ) {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const needsReview = reportKindNeedsReview(reportKind);
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
        report_kind: reportKind,
        reviewed_at: needsReview ? null : now,
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
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "active") {
      updates.moderation_reason = moderationReason ?? null;
    } else {
      updates.moderation_reason = moderationReason ?? null;
      if (status === "flagged") {
        updates.reviewed_at = null;
        updates.reviewed_by = null;
      }
    }

    const { data, error } = await supabase
      .from("multiplier_reports")
      .update(updates)
      .eq("id", reportId)
      .select("*")
      .single();

    if (error) throw error;
    return this.mapReport(data);
  }

  async approveReport(reportId: string, moderatorId: string) {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("multiplier_reports")
      .update({
        status: "active",
        moderation_reason: null,
        reviewed_at: now,
        reviewed_by: moderatorId,
        updated_at: now,
      })
      .eq("id", reportId)
      .select("*")
      .single();

    if (error) throw error;
    return this.mapReport(data);
  }

  async clearFlaggedForPlace(placeId: string) {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("multiplier_reports")
      .update({
        status: "active",
        moderation_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("place_id", placeId)
      .eq("status", "flagged");

    if (error) throw error;
  }

  async findRecentForAdmin(limit = 50) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("multiplier_reports")
      .select(
        `
        id, multiplier, transaction_date, payment_context, notes, status,
        moderation_reason, reviewed_at, report_kind, created_at, place_id,
        places ( id, name, city, province ),
        reporter:profiles!user_id ( id, username )
      `,
      )
      .or(
        "status.eq.flagged,and(status.eq.active,reviewed_at.is.null,report_kind.in.(new_location,error))",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Admin reports query failed: ${error.message}`);
    }
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
      reportKind: row.report_kind as MultiplierReport["reportKind"],
      createdAt: row.created_at as string,
    };
  }
}

export const reportRepository = new ReportRepository();
