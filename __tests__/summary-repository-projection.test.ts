import { describe, expect, it } from "vitest";
import { projectAggregationInput } from "@/server/repositories/summary-repository";

describe("summary repository projection contract", () => {
  it("maps database report columns to aggregation input", () => {
    expect(projectAggregationInput({
      multiplier: "3",
      transaction_date: "2026-07-18",
      user_id: "user-1",
      status: "active",
    })).toEqual({
      multiplier: 3,
      transactionDate: "2026-07-18",
      userId: "user-1",
      status: "active",
    });
  });
});
