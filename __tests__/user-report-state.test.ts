import { describe, expect, it } from "vitest";
import {
  canUserRemoveReport,
  isActiveUserReport,
  isArchivedUserReport,
} from "@/lib/reports/user-report-state";
import type { UserOwnedReport } from "@/lib/reports/user-report-state";

function sampleReport(
  overrides: Partial<UserOwnedReport> = {},
): UserOwnedReport {
  return {
    id: "report-1",
    placeId: "place-1",
    userId: "user-1",
    cardProductId: "card-1",
    multiplier: 5,
    transactionDate: "2026-07-01",
    paymentContext: "in_store",
    notes: null,
    status: "active",
    reportKind: "error",
    reviewedAt: null,
    reviewedBy: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("canUserRemoveReport", () => {
  it("allows removing pending review reports only", () => {
    expect(canUserRemoveReport(sampleReport())).toBe(true);
    expect(
      canUserRemoveReport(
        sampleReport({ reportKind: "new_location", reviewedAt: null }),
      ),
    ).toBe(true);
  });

  it("blocks removed, reviewed, and auto-approved reports", () => {
    expect(canUserRemoveReport(sampleReport({ status: "removed" }))).toBe(false);
    expect(
      canUserRemoveReport(
        sampleReport({ reviewedBy: "moderator-1", reviewedAt: "2026-07-02" }),
      ),
    ).toBe(false);
    expect(
      canUserRemoveReport(
        sampleReport({ reportKind: "confirm", reviewedAt: "2026-07-01" }),
      ),
    ).toBe(false);
    expect(
      canUserRemoveReport(
        sampleReport({ reportKind: "update", reviewedAt: "2026-07-01" }),
      ),
    ).toBe(false);
  });
});

describe("report list views", () => {
  it("keeps live unreviewed reports in active and moderated ones in archive", () => {
    expect(isActiveUserReport(sampleReport())).toBe(true);
    expect(isArchivedUserReport(sampleReport())).toBe(false);

    const reviewed = sampleReport({
      reviewedBy: "moderator-1",
      reviewedAt: "2026-07-02",
    });
    expect(isActiveUserReport(reviewed)).toBe(false);
    expect(isArchivedUserReport(reviewed)).toBe(true);
  });
});
