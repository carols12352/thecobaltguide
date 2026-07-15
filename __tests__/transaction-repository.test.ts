import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { transactionRepository } from "@/server/repositories/transaction-repository";

const reportRow = {
  id: "report-1",
  place_id: "place-1",
  user_id: "user-1",
  card_product_id: "card-1",
  multiplier: "5",
  transaction_date: "2026-07-15",
  payment_context: "in_store",
  notes: null,
  status: "active",
  report_kind: "update",
  reviewed_at: "2026-07-15T00:00:00.000Z",
  reviewed_by: null,
  created_at: "2026-07-15T00:00:00.000Z",
};

describe("transactionRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits one RPC containing the full report business action", async () => {
    rpc.mockResolvedValue({ data: reportRow, error: null });
    const result = await transactionRepository.submitReport(
      "place-1",
      "user-1",
      "card-1",
      {
        multiplier: 5,
        transactionDate: "2026-07-15",
        paymentContext: "in_store",
        intent: "normal",
      },
      "update",
    );

    expect(rpc).toHaveBeenCalledWith("submit_report_transactional", {
      p_place_id: "place-1",
      p_user_id: "user-1",
      p_card_product_id: "card-1",
      p_multiplier: "5",
      p_transaction_date: "2026-07-15",
      p_payment_context: "in_store",
      p_notes: null,
      p_report_kind: "update",
    });
    expect(result).toMatchObject({ id: "report-1", multiplier: 5 });
  });

  it("returns moderation side effects from the same RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        report: reportRow,
        flagId: null,
        dismissedFlagIds: ["flag-1"],
      },
      error: null,
    });
    const result = await transactionRepository.moderateReport({
      reportId: "report-1",
      moderatorId: "mod-1",
      action: "approve",
    });
    expect(result.dismissedFlagIds).toEqual(["flag-1"]);
    expect(result.report.id).toBe("report-1");
  });

  it("propagates database failures without partial follow-up writes", async () => {
    const error = Object.assign(new Error("transaction failed"), {
      code: "P0001",
    });
    rpc.mockResolvedValue({ data: null, error });
    await expect(
      transactionRepository.deleteOwnReport("report-1", "user-1"),
    ).rejects.toBe(error);
    expect(rpc).toHaveBeenCalledOnce();
  });
});
