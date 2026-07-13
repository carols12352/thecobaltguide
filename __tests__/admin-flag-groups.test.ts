import { describe, expect, it } from "vitest";
import {
  formatAdminFlagGroupHeadline,
  groupAdminFlags,
  uniqueReporterIdsForReview,
  type AdminFlagRow,
} from "@/lib/flags/admin-flag-groups";
import { reputationDeltaForFlagReview } from "@/lib/reputation/scoring";

function flag(
  overrides: Partial<AdminFlagRow> & {
    place_id: string;
    id: string;
    created_at: string;
  },
): AdminFlagRow {
  return {
    reason: "wrong_address",
    details: null,
    places: { id: overrides.place_id, name: "Test Place", city: "Toronto" },
    reporter: { id: "user-1", username: "alice" },
    ...overrides,
  };
}

describe("groupAdminFlags", () => {
  it("merges open flags for the same place into one group", () => {
    const groups = groupAdminFlags([
      flag({
        id: "f1",
        place_id: "p1",
        created_at: "2026-07-01T12:00:00.000Z",
        reporter: { id: "u1", username: "alice" },
      }),
      flag({
        id: "f2",
        place_id: "p1",
        created_at: "2026-07-02T12:00:00.000Z",
        reporter: { id: "u2", username: "bob" },
        reason: "duplicate",
      }),
      flag({
        id: "f3",
        place_id: "p2",
        created_at: "2026-07-03T12:00:00.000Z",
        reporter: { id: "u3", username: "cara" },
      }),
    ]);

    expect(groups).toHaveLength(2);
    const placeOne = groups.find((group) => group.placeId === "p1");
    expect(placeOne).toMatchObject({
      flagCount: 2,
      reporterCount: 2,
      placeName: "Test Place",
      reasons: ["wrong_address", "duplicate"],
      latestCreatedAt: "2026-07-02T12:00:00.000Z",
    });
    expect(placeOne?.flags).toHaveLength(2);
  });

  it("counts duplicate submissions from the same reporter once", () => {
    const groups = groupAdminFlags([
      flag({
        id: "f1",
        place_id: "p1",
        created_at: "2026-07-01T12:00:00.000Z",
        reporter: { id: "u1", username: "alice" },
      }),
      flag({
        id: "f2",
        place_id: "p1",
        created_at: "2026-07-05T12:00:00.000Z",
        reporter: { id: "u1", username: "alice" },
        reason: "other",
      }),
    ]);

    expect(groups[0]).toMatchObject({
      flagCount: 2,
      reporterCount: 1,
      latestCreatedAt: "2026-07-05T12:00:00.000Z",
    });
  });

  it("sorts groups by latest flag date descending", () => {
    const groups = groupAdminFlags([
      flag({
        id: "f1",
        place_id: "p1",
        created_at: "2026-06-01T12:00:00.000Z",
      }),
      flag({
        id: "f2",
        place_id: "p2",
        created_at: "2026-07-10T12:00:00.000Z",
        reporter: { id: "u2", username: "bob" },
      }),
    ]);

    expect(groups[0]?.placeId).toBe("p2");
  });
});

describe("formatAdminFlagGroupHeadline", () => {
  it("uses plural copy for multiple reporters", () => {
    expect(
      formatAdminFlagGroupHeadline({ reporterCount: 3, flagCount: 4 }),
    ).toBe("3 users flagged this place");
  });

  it("notes multiple flags from one reporter", () => {
    expect(
      formatAdminFlagGroupHeadline({ reporterCount: 1, flagCount: 2 }),
    ).toBe("1 user flagged this place (2 flags)");
  });
});

describe("uniqueReporterIdsForReview", () => {
  it("dedupes reporters for a single review action", () => {
    const reporterIds = uniqueReporterIdsForReview([
      { user_id: "u1" },
      { user_id: "u2" },
      { user_id: "u1" },
    ]);

    expect(reporterIds).toEqual(["u1", "u2"]);
  });

  it("applies reputation once per reporter in a group review", () => {
    const reporterIds = uniqueReporterIdsForReview([
      { user_id: "u1" },
      { user_id: "u2" },
      { user_id: "u1" },
      { user_id: "u3" },
    ]);

    const totalDelta = reporterIds.reduce(
      (sum, _userId) => sum + reputationDeltaForFlagReview("open", "resolved"),
      0,
    );

    expect(reporterIds).toHaveLength(3);
    expect(totalDelta).toBe(6);
  });
});
