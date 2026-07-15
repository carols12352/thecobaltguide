import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));
vi.mock("@/lib/cache/redis", () => redisMocks);
vi.mock("@/lib/monitoring/sentry", () => ({ recordMetric: vi.fn() }));

import {
  getCachedGeocode,
  setCachedGeocode,
} from "@/lib/cache/geocode-cache";
import { geocodingService } from "@/server/services/geocoding-service";

describe("geocoding protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    redisMocks.cacheGet.mockResolvedValue(null);
    redisMocks.cacheSet.mockResolvedValue(undefined);
  });

  it("hashes sensitive lookup values before using them as cache keys", async () => {
    const query = { addressLine1: "123 Private Street", city: "Toronto" };
    await getCachedGeocode("forward", query);
    const key = redisMocks.cacheGet.mock.calls[0]?.[0] as string;
    expect(key).toMatch(/^cobalt:cache:geocode:v1:forward:[a-f0-9]{64}$/);
    expect(key).not.toContain("Private");

    await setCachedGeocode("forward", query, { results: [] });
    expect(redisMocks.cacheSet).toHaveBeenCalledWith(key, { results: [] }, 3600);
  });

  it("retries a transient Mapbox failure once and returns the recovered result", async () => {
    vi.stubEnv("MAPBOX_ACCESS_TOKEN", "test-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            features: [
              {
                id: "address.1",
                text: "King Street West",
                address: "123",
                place_name: "123 King Street West, Toronto, Ontario, Canada",
                place_type: ["address"],
                center: [-79.39, 43.64],
                context: [
                  { id: "place.1", text: "Toronto" },
                  { id: "region.1", text: "Ontario", short_code: "CA-ON" },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const results = await geocodingService.searchAddress("123 King St W");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results[0]).toMatchObject({
      addressLine1: "123 King Street West",
      city: "Toronto",
      province: "ON",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    fetchMock.mockRestore();
  });
});
