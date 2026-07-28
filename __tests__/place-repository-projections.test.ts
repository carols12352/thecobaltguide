import { describe, expect, it } from "vitest";
import {
  profileUsername,
  projectAdminFlag,
  projectMapPlace,
  projectPlaceDetail,
  projectViewportPlace,
} from "@/server/repositories/place-projections";
import { adminIlikePattern } from "@/server/repositories/admin-place-query-repository";

describe("place repository projection contracts", () => {
  it("projects the public viewport RPC shape", () => {
    expect(projectViewportPlace({
      id: "place-1",
      name: "Market",
      address_line1: "1 King St",
      city: "Toronto",
      province: "ON",
      latitude: 43.65,
      longitude: -79.38,
      multiplier: "5",
      confidence_level: "high",
      recent_report_count: 4,
      last_reported_at: "2026-07-01",
      category: "grocery",
      source_kind: "rewards_canada",
    })).toEqual({
      id: "place-1",
      name: "Market",
      addressLine1: "1 King St",
      city: "Toronto",
      province: "ON",
      latitude: 43.65,
      longitude: -79.38,
      multiplier: 5,
      confidenceLevel: "high",
      recentReportCount: 4,
      lastReportedAt: "2026-07-01",
      category: "grocery",
      sourceKind: "rewards_canada",
    });
  });

  it("selects only the requested card summary for city map rows", () => {
    const projected = projectMapPlace({
      id: "place-2",
      name: "Cafe",
      category: "restaurant",
      source_kind: "community",
      location: { type: "Point", coordinates: [-79.4, 43.7] },
      place_multiplier_summaries: [
        { card_product_id: "other", current_multiplier: "2" },
        {
          card_product_id: "cobalt",
          current_multiplier: "5",
          confidence_level: "recently_confirmed",
          recent_report_count: 3,
          last_reported_at: "2026-07-18",
        },
      ],
    }, "cobalt");

    expect(projected).toMatchObject({
      id: "place-2",
      latitude: 43.7,
      longitude: -79.4,
      multiplier: 5,
      confidenceLevel: "recently_confirmed",
      recentReportCount: 3,
      sourceKind: "community",
    });
  });

  it("keeps the public detail projection stable", () => {
    const detail = projectPlaceDetail({
      id: "place-3",
      name: "Deli",
      address_line1: "2 Queen St",
      city: "Toronto",
      province: "ON",
      postal_code: "M5H 2N2",
      country_code: "CA",
      category: "restaurant",
      accepts_amex: true,
      location: "POINT(-79.38 43.65)",
      status: "active",
      brand_id: "brand-1",
      google_place_id: "google-place-3",
      source_kind: "rewards_canada",
      merchant_brands: { name: "Deli Group" },
    }, {
      current_multiplier: "5",
      confidence_score: 0.9,
      confidence_level: "high",
      recent_report_count: 5,
      unique_reporter_count: 3,
      last_reported_at: "2026-07-19",
      score_1x: "0",
      score_2x: "0",
      score_3x: "0",
      score_5x: "8.5",
    });

    expect(detail).toMatchObject({
      id: "place-3",
      brandName: "Deli Group",
      googlePlaceId: "google-place-3",
      latitude: 43.65,
      longitude: -79.38,
      sourceKind: "rewards_canada",
      summary: { currentMultiplier: 5, confidenceLevel: "high", score5x: 8.5 },
    });
  });

  it("normalizes admin relation shapes and escapes ilike input", () => {
    expect(profileUsername([{ username: "reviewer" }])).toBe("reviewer");
    expect(projectAdminFlag({
      id: "flag-1",
      reason: "duplicate",
      details: null,
      status: "open",
      created_at: "2026-07-20",
      resolved_at: null,
      reporter: { username: "alice" },
      resolver: [],
    })).toMatchObject({ reporterUsername: "alice", reviewedByUsername: null });
    expect(adminIlikePattern("50%_off\\today")).toBe("%50\\%\\_off\\\\today%");
  });
});
