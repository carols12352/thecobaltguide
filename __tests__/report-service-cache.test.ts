import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheMocks = vi.hoisted(() => ({
  getCachedUserAccountReports: vi.fn(),
  setCachedUserAccountReports: vi.fn(),
  invalidateUserAccountCaches: vi.fn(),
}));

vi.mock("@/lib/cache/user-account-cache", () => cacheMocks);

const repoMocks = vi.hoisted(() => ({
  findByUserId: vi.fn(),
}));

vi.mock("@/server/repositories/report-repository", () => ({
  reportRepository: repoMocks,
}));

vi.mock("@/server/repositories/place-repository", () => ({
  placeRepository: {},
}));

vi.mock("@/server/services/summary-service", () => ({
  summaryService: { refreshPlaceSummary: vi.fn() },
}));

vi.mock("@/server/services/reputation-service", () => ({
  reputationService: {
    assertCanSubmit: vi.fn(),
    onReportSubmitted: vi.fn(),
    onOwnReportDeleted: vi.fn(),
  },
}));

vi.mock("@/lib/cache/admin-cache", () => ({
  invalidateAdminCaches: vi.fn(),
}));

vi.mock("@/lib/cache/place-cache", () => ({
  invalidatePlaceReadCaches: vi.fn(),
}));

import { reportService } from "@/server/services/report-service";

describe("reportService user account cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheMocks.getCachedUserAccountReports.mockResolvedValue(null);
    repoMocks.findByUserId.mockResolvedValue({
      reports: [],
      total: 0,
      page: 1,
      pageSize: 5,
    });
  });

  it("returns cached user reports without hitting the repository", async () => {
    const cached = {
      reports: [{ id: "report-1" }],
      total: 1,
      page: 1,
      pageSize: 5,
    };
    cacheMocks.getCachedUserAccountReports.mockResolvedValue(cached);

    const result = await reportService.getReportsForUser("user-1", {
      view: "active",
      page: 1,
      pageSize: 5,
    });

    expect(result).toBe(cached);
    expect(repoMocks.findByUserId).not.toHaveBeenCalled();
    expect(cacheMocks.setCachedUserAccountReports).not.toHaveBeenCalled();
  });

  it("loads from repository and caches on miss", async () => {
    const result = await reportService.getReportsForUser("user-1", {
      view: "archive",
      page: 2,
      pageSize: 5,
    });

    expect(repoMocks.findByUserId).toHaveBeenCalledWith("user-1", {
      view: "archive",
      page: 2,
      pageSize: 5,
    });
    expect(cacheMocks.setCachedUserAccountReports).toHaveBeenCalledWith(
      "user-1",
      { view: "archive", page: 2, pageSize: 5 },
      result,
    );
  });
});
