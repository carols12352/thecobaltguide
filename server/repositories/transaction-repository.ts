import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateReportInput } from "@/server/validation/schemas";
import type {
  MultiplierReport,
  ReportKind,
  ReportStatus,
} from "@/types/domain";

type DatabaseError = Error & { code?: string; details?: string };

function mapReport(row: Record<string, unknown>): MultiplierReport {
  return {
    id: row.id as string,
    placeId: row.place_id as string,
    userId: row.user_id as string,
    cardProductId: row.card_product_id as string,
    multiplier: Number(row.multiplier) as MultiplierReport["multiplier"],
    transactionDate: row.transaction_date as string,
    paymentContext: row.payment_context as MultiplierReport["paymentContext"],
    notes: (row.notes as string | null) ?? null,
    status: row.status as MultiplierReport["status"],
    reportKind: row.report_kind as MultiplierReport["reportKind"],
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function throwDatabaseError(error: DatabaseError | null): void {
  if (error) throw error;
}

export class TransactionRepository {
  async submitReport(
    placeId: string,
    userId: string,
    cardProductId: string,
    input: CreateReportInput,
    reportKind: ReportKind,
  ): Promise<MultiplierReport> {
    const { data, error } = await createAdminClient().rpc(
      "submit_report_transactional",
      {
        p_place_id: placeId,
        p_user_id: userId,
        p_card_product_id: cardProductId,
        p_multiplier: String(input.multiplier),
        p_transaction_date: input.transactionDate,
        p_payment_context: input.paymentContext,
        p_notes: input.notes ?? null,
        p_report_kind: reportKind,
      },
    );
    throwDatabaseError(error);
    return mapReport(data as Record<string, unknown>);
  }

  async deleteOwnReport(reportId: string, userId: string) {
    const { data, error } = await createAdminClient().rpc(
      "delete_own_report_transactional",
      { p_report_id: reportId, p_user_id: userId },
    );
    throwDatabaseError(error);
    return mapReport(data as Record<string, unknown>);
  }

  async moderateReport(input: {
    reportId: string;
    moderatorId: string;
    action: "approve" | "status";
    status?: ReportStatus;
    reason?: string;
  }) {
    const { data, error } = await createAdminClient().rpc(
      "moderate_report_transactional",
      {
        p_report_id: input.reportId,
        p_moderator_id: input.moderatorId,
        p_action: input.action,
        p_status: input.status ?? null,
        p_reason: input.reason ?? null,
      },
    );
    throwDatabaseError(error);
    const result = data as {
      report: Record<string, unknown>;
      flagId: string | null;
      dismissedFlagIds: string[];
    };
    return {
      report: mapReport(result.report),
      flagId: result.flagId,
      dismissedFlagIds: result.dismissedFlagIds ?? [],
    };
  }

  async resolvePlaceFlags(
    placeId: string,
    moderatorId: string,
    status: "resolved" | "dismissed",
  ) {
    const { data, error } = await createAdminClient().rpc(
      "resolve_place_flags_transactional",
      {
        p_place_id: placeId,
        p_moderator_id: moderatorId,
        p_status: status,
      },
    );
    throwDatabaseError(error);
    return data as { resolvedFlagIds: string[]; clearedReports: boolean };
  }

  async mergePlaces(
    sourcePlaceId: string,
    targetPlaceId: string,
    moderatorId: string,
    reason?: string,
  ) {
    const { data, error } = await createAdminClient().rpc(
      "merge_places_transactional",
      {
        p_source_place_id: sourcePlaceId,
        p_target_place_id: targetPlaceId,
        p_moderator_id: moderatorId,
        p_reason: reason ?? null,
      },
    );
    throwDatabaseError(error);
    return data as { sourcePlaceId: string; targetPlaceId: string };
  }
}

export const transactionRepository = new TransactionRepository();
