import { describe, expect, it } from "vitest";
import {
  adminPlacesCacheKey,
  adminReportsCacheKey,
  mapCacheKey,
  placeCacheKey,
} from "@/lib/cache/keys";
import { alignViewportToGrid } from "@/lib/map/viewport-grid";

describe("cache keys", () => {
  it("builds stable map cache keys for grid-aligned viewports", () => {
    const alignedA = alignViewportToGrid({
      north: 43.673100131,
      south: 43.633293272,
      east: -79.344061206,
      west: -79.422338793,
      zoom: 13,
    });
    const alignedB = alignViewportToGrid({
      north: 43.6731004,
      south: 43.6332933,
      east: -79.344061,
      west: -79.422339,
      zoom: 13,
    });

    const keyA = mapCacheKey(1, {
      gridKey: alignedA.gridKey,
      zoom: 13,
      multiplier: 5,
      category: "restaurant",
    });
    const keyB = mapCacheKey(1, {
      gridKey: alignedB.gridKey,
      zoom: 13,
      multiplier: 5,
      category: "restaurant",
    });

    expect(keyA).toBe(keyB);
    expect(keyA).toContain("cobalt:cache:map:v1:1:grid:");
  });

  it("changes map cache keys when version bumps", () => {
    const params = {
      gridKey: "13:872-876:-1589--1584",
      zoom: 13,
    };

    expect(mapCacheKey(1, params)).not.toBe(mapCacheKey(2, params));
  });

  it("builds place cache keys", () => {
    expect(placeCacheKey("abc-123")).toBe("cobalt:cache:place:v1:abc-123");
  });

  it("builds stable admin places cache keys", () => {
    const params = {
      query: "  Toronto  ",
      status: "active",
      page: 2,
      pageSize: 10,
    };

    expect(adminPlacesCacheKey(1, params)).toBe(
      "cobalt:cache:admin:v1:1:places:toronto:active:2:10",
    );
    expect(adminPlacesCacheKey(2, params)).not.toBe(adminPlacesCacheKey(1, params));
  });

  it("builds admin reports cache keys", () => {
    expect(adminReportsCacheKey(3, 50)).toBe("cobalt:cache:admin:v1:3:reports:50");
  });
});
