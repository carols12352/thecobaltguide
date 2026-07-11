import { describe, expect, it } from "vitest";
import {
  calculateAggregation,
  deriveConfidenceLevel,
  getRecencyWeight,
} from "@/server/services/aggregation";
import type { AggregationInput } from "@/types/domain";
import { nameSimilarity, normalizeMerchantName } from "@/lib/utils";

describe("getRecencyWeight", () => {
  const now = new Date("2026-07-10");

  it("returns 1.0 for reports within 30 days", () => {
    expect(getRecencyWeight("2026-07-01", now)).toBe(1.0);
  });

  it("returns 0.5 for reports 31-90 days old", () => {
    expect(getRecencyWeight("2026-04-15", now)).toBe(0.5);
  });

  it("returns 0.2 for reports 91-180 days old", () => {
    expect(getRecencyWeight("2026-01-15", now)).toBe(0.2);
  });

  it("returns 0 for reports older than 180 days", () => {
    expect(getRecencyWeight("2025-01-01", now)).toBe(0);
  });
});

describe("calculateAggregation", () => {
  const now = new Date("2026-07-10");

  it("selects multiplier with highest weighted score", () => {
    const reports: AggregationInput[] = [
      { multiplier: 5, transactionDate: "2026-07-05", userId: "u1", status: "active" },
      { multiplier: 5, transactionDate: "2026-07-01", userId: "u2", status: "active" },
      { multiplier: 1, transactionDate: "2026-04-15", userId: "u3", status: "active" },
    ];

    const result = calculateAggregation(reports, now);
    expect(result.currentMultiplier).toBe(5);
    expect(result.confidenceScore).toBeCloseTo(0.8, 1);
  });

  it("excludes removed reports", () => {
    const reports: AggregationInput[] = [
      { multiplier: 5, transactionDate: "2026-07-05", userId: "u1", status: "removed" },
      { multiplier: 1, transactionDate: "2026-07-05", userId: "u2", status: "active" },
    ];

    const result = calculateAggregation(reports, now);
    expect(result.currentMultiplier).toBe(1);
  });

  it("returns insufficient when fewer than 2 reports", () => {
    const reports: AggregationInput[] = [
      { multiplier: 5, transactionDate: "2026-07-05", userId: "u1", status: "active" },
    ];

    const result = calculateAggregation(reports, now);
    expect(result.confidenceLevel).toBe("insufficient");
  });

  it("returns high for Rewards Canada imports with one report", () => {
    const reports: AggregationInput[] = [
      { multiplier: 5, transactionDate: "2026-07-05", userId: "u1", status: "active" },
    ];

    const result = calculateAggregation(reports, now, {
      importedFromRewardsCanada: true,
    });
    expect(result.confidenceLevel).toBe("high");
  });
});

describe("deriveConfidenceLevel", () => {
  it("returns high with strong agreement and 3+ reporters", () => {
    expect(deriveConfidenceLevel(0.85, 5, 3, 1)).toBe("high");
  });

  it("returns high for imported data with a single report", () => {
    expect(
      deriveConfidenceLevel(1, 1, 1, 1, { importedFromRewardsCanada: true }),
    ).toBe("high");
  });

  it("returns disputed for imported data with conflicting reports", () => {
    expect(
      deriveConfidenceLevel(0.5, 3, 3, 1, { importedFromRewardsCanada: true }),
    ).toBe("disputed");
  });

  it("returns disputed below 60% agreement", () => {
    expect(deriveConfidenceLevel(0.55, 5, 3, 1)).toBe("disputed");
  });

  it("returns recently_confirmed with multiple recent matching reports", () => {
    expect(deriveConfidenceLevel(0.9, 4, 2, 3)).toBe("recently_confirmed");
  });
});

describe("normalizeMerchantName", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeMerchantName("Metro Plus!")).toBe("metro plus");
  });
});

describe("nameSimilarity", () => {
  it("returns high similarity for similar names", () => {
    expect(nameSimilarity("Metro Grocery", "Metro Grocery Store")).toBeGreaterThan(0.4);
  });

  it("returns low similarity for different names", () => {
    expect(nameSimilarity("Metro", "Loblaws")).toBeLessThan(0.3);
  });
});
