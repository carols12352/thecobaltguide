import { describe, expect, it } from "vitest";
import {
  adminPlacesCacheKey,
  adminReportsCacheKey,
  mapCacheKey,
  placeCacheKey,
} from "@/lib/cache/keys";

describe("cache keys", () => {
  it("builds stable map cache keys for rounded viewport bounds", () => {
    const params = {
      north: 43.673100131,
      south: 43.633293272,
      east: -79.344061206,
      west: -79.422338793,
      zoom: 13,
      multiplier: 5,
      category: "restaurant",
    };

    const keyA = mapCacheKey(1, params);
    const keyB = mapCacheKey(1, {
      ...params,
      north: 43.6731004,
      south: 43.6332933,
    });

    expect(keyA).toBe(keyB);
    expect(keyA).toContain("cobalt:cache:map:v1:1:");
  });

  it("changes map cache keys when version bumps", () => {
    const params = {
      north: 43.67,
      south: 43.63,
      east: -79.34,
      west: -79.42,
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
