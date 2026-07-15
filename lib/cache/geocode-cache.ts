import { createHash } from "node:crypto";
import { CACHE_DURATIONS } from "@/config/constants";
import { cacheGet, cacheSet } from "@/lib/cache/redis";

type MemoryEntry = { value: unknown; expiresAt: number };
const memoryCache = new Map<string, MemoryEntry>();

function cacheKey(kind: "forward" | "reverse", value: unknown): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
  return `cobalt:cache:geocode:v1:${kind}:${digest}`;
}

export async function getCachedGeocode<T>(
  kind: "forward" | "reverse",
  value: unknown,
): Promise<T | null> {
  const key = cacheKey(kind, value);
  const memory = memoryCache.get(key);
  if (memory && memory.expiresAt > Date.now()) return memory.value as T;
  if (memory) memoryCache.delete(key);

  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    memoryCache.set(key, {
      value: cached,
      expiresAt: Date.now() + CACHE_DURATIONS.geocodeSeconds * 1000,
    });
  }
  return cached;
}

export async function setCachedGeocode(
  kind: "forward" | "reverse",
  value: unknown,
  result: unknown,
): Promise<void> {
  const key = cacheKey(kind, value);
  memoryCache.set(key, {
    value: result,
    expiresAt: Date.now() + CACHE_DURATIONS.geocodeSeconds * 1000,
  });
  await cacheSet(key, result, CACHE_DURATIONS.geocodeSeconds);
}
