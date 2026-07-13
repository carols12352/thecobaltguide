import { describe, expect, it } from "vitest";
import { reportKindNeedsReview, REPORT_KIND_LABELS } from "@/lib/reports/report-kind";

describe("reportKindNeedsReview", () => {
  it("requires review for new locations and error reports only", () => {
    expect(reportKindNeedsReview("new_location")).toBe(true);
    expect(reportKindNeedsReview("error")).toBe(true);
    expect(reportKindNeedsReview("update")).toBe(false);
    expect(reportKindNeedsReview("confirm")).toBe(false);
  });

  it("labels every report kind", () => {
    expect(REPORT_KIND_LABELS.new_location).toBeTruthy();
    expect(REPORT_KIND_LABELS.error).toBeTruthy();
    expect(REPORT_KIND_LABELS.update).toBeTruthy();
    expect(REPORT_KIND_LABELS.confirm).toBeTruthy();
  });
});
