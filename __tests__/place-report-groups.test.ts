import { describe, expect, it } from "vitest";
import {
  formatPlaceReportGroupLabel,
  groupPlaceReports,
} from "@/lib/reports/place-report-groups";
import type { MultiplierReport } from "@/types/domain";

function report(
  overrides: Partial<MultiplierReport> & {
    userId: string;
    multiplier: MultiplierReport["multiplier"];
    paymentContext: MultiplierReport["paymentContext"];
    transactionDate: string;
  },
): MultiplierReport {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    placeId: "place-1",
    cardProductId: "card-1",
    notes: null,
    status: "active",
    reportKind: "normal",
    createdAt: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("groupPlaceReports", () => {
  it("groups by multiplier and payment context", () => {
    const groups = groupPlaceReports([
      report({
        userId: "u1",
        multiplier: 5,
        paymentContext: "in_store",
        transactionDate: "2026-07-01",
      }),
      report({
        userId: "u2",
        multiplier: 5,
        paymentContext: "in_store",
        transactionDate: "2026-07-02",
      }),
      report({
        userId: "u3",
        multiplier: 3,
        paymentContext: "in_store",
        transactionDate: "2026-07-03",
      }),
    ]);

    expect(groups).toHaveLength(2);
    const fiveX = groups.find((g) => g.multiplier === 5);
    expect(fiveX).toMatchObject({
      reporterCount: 2,
      reportCount: 2,
      latestTransactionDate: "2026-07-02",
    });
  });

  it("counts duplicate submissions from the same user separately for reportCount", () => {
    const groups = groupPlaceReports([
      report({
        userId: "u1",
        multiplier: 5,
        paymentContext: "online",
        transactionDate: "2026-07-01",
      }),
      report({
        userId: "u1",
        multiplier: 5,
        paymentContext: "online",
        transactionDate: "2026-07-05",
      }),
    ]);

    expect(groups[0]).toMatchObject({
      reporterCount: 1,
      reportCount: 2,
      latestTransactionDate: "2026-07-05",
    });
  });

  it("sorts groups by latest transaction date descending", () => {
    const groups = groupPlaceReports([
      report({
        userId: "u1",
        multiplier: 1,
        paymentContext: "in_store",
        transactionDate: "2026-06-01",
      }),
      report({
        userId: "u2",
        multiplier: 5,
        paymentContext: "in_store",
        transactionDate: "2026-07-10",
      }),
    ]);

    expect(groups[0]?.multiplier).toBe(5);
  });
});

describe("formatPlaceReportGroupLabel", () => {
  it("uses singular copy for one reporter", () => {
    const label = formatPlaceReportGroupLabel(
      {
        multiplier: 5,
        paymentContext: "in_store",
        reporterCount: 1,
        reportCount: 1,
        latestTransactionDate: "2026-07-01",
      },
      { in_store: "In-store", online: "Online", gas_pump: "Gas pump", delivery: "Delivery", other: "Other" },
    );

    expect(label).toBe("1 user reported this (5x, In-store)");
  });

  it("uses plural copy for multiple reporters", () => {
    const label = formatPlaceReportGroupLabel(
      {
        multiplier: 3,
        paymentContext: "online",
        reporterCount: 4,
        reportCount: 4,
        latestTransactionDate: "2026-07-01",
      },
      { in_store: "In-store", online: "Online", gas_pump: "Gas pump", delivery: "Delivery", other: "Other" },
    );

    expect(label).toBe("4 users reported this (3x, Online)");
  });
});
