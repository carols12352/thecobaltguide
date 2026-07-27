import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
  cacheBumpVersion: vi.fn(),
  cacheDel: vi.fn(),
  isRedisReadConfigured: vi.fn(),
  isRedisWriteConfigured: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  ...redisMocks,
  cacheGet: vi.fn(),
  cacheGetVersion: vi.fn(),
  cacheSet: vi.fn(),
}));

import { invalidatePlaceReadCaches } from "@/lib/cache/place-cache";

describe("place cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMocks.isRedisReadConfigured.mockReturnValue(true);
    redisMocks.isRedisWriteConfigured.mockReturnValue(true);
    redisMocks.cacheBumpVersion.mockResolvedValue(2);
    redisMocks.cacheDel.mockResolvedValue(undefined);
  });

  it("bumps both global versions and deletes the requested place detail", async () => {
    await expect(invalidatePlaceReadCaches("seed-replacement")).resolves.toBe(true);
    expect(redisMocks.cacheDel).toHaveBeenCalledWith(
      "cobalt:cache:place:v2:seed-replacement",
    );
    expect(redisMocks.cacheBumpVersion).toHaveBeenCalledTimes(2);
  });

  it("reports that invalidation was skipped without a Redis write token", async () => {
    redisMocks.isRedisWriteConfigured.mockReturnValue(false);
    await expect(invalidatePlaceReadCaches("seed-replacement")).resolves.toBe(false);
    expect(redisMocks.cacheBumpVersion).not.toHaveBeenCalled();
  });
});
