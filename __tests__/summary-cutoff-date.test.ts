import { describe, expect, it } from "vitest";
import { RECENCY_WEIGHTS } from "@/config/constants";
import { getSummaryCutoffDate } from "@/lib/summary/cutoff-date";

describe("getSummaryCutoffDate", () => {
  it("returns a date exactly excludeAfterDays before now", () => {
    const now = new Date("2026-07-13T12:00:00.000Z");
    const cutoff = getSummaryCutoffDate(now);
    const expected = new Date(now);
    expected.setUTCDate(expected.getUTCDate() - RECENCY_WEIGHTS.excludeAfterDays);
    expect(cutoff).toBe(expected.toISOString().slice(0, 10));
  });
});
