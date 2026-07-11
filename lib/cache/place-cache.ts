import { CACHE_DURATIONS } from "@/config/constants";
import {
  cacheDel,
  cacheGet,
  cacheIncr,
  cacheSet,
  isRedisReadConfigured,
  isRedisWriteConfigured,
} from "@/lib/cache/redis";
import {
  MAP_VERSION_KEY,
  mapCacheKey,
  placeCacheKey,
  searchCacheKey,
} from "@/lib/cache/keys";
import type { MapPlace, PlaceDetail } from "@/types/domain";

export async function getMapCacheVersion(): Promise<number> {
  if (!isRedisReadConfigured()) return 0;

  const version = await cacheGet<number>(MAP_VERSION_KEY);
  return version ?? 1;
}

async function getMapCacheVersionForWrite(): Promise<number> {
  if (!isRedisReadConfigured()) return 1;

  const version = await cacheGet<number>(MAP_VERSION_KEY);
  return version ?? 1;
}

export async function getCachedMapPlaces(
  params: Parameters<typeof mapCacheKey>[1],
): Promise<{ places: MapPlace[]; truncated: boolean } | null> {
  const version = await getMapCacheVersion();
  if (version === 0) return null;

  return cacheGet(mapCacheKey(version, params));
}

export async function setCachedMapPlaces(
  params: Parameters<typeof mapCacheKey>[1],
  value: { places: MapPlace[]; truncated: boolean },
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getMapCacheVersionForWrite();

  await cacheSet(
    mapCacheKey(version, params),
    value,
    CACHE_DURATIONS.mapRegionSeconds,
  );
}

export async function getCachedPlace(
  placeId: string,
): Promise<PlaceDetail | null> {
  if (!isRedisReadConfigured()) return null;
  return cacheGet<PlaceDetail>(placeCacheKey(placeId));
}

export async function setCachedPlace(place: PlaceDetail): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  await cacheSet(
    placeCacheKey(place.id),
    place,
    CACHE_DURATIONS.placeDetailsSeconds,
  );
}

export async function getCachedSearch(
  query: string,
  limit: number,
): Promise<MapPlace[] | null> {
  if (!isRedisReadConfigured()) return null;
  return cacheGet<MapPlace[]>(searchCacheKey(query, limit));
}

export async function setCachedSearch(
  query: string,
  limit: number,
  places: MapPlace[],
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  await cacheSet(
    searchCacheKey(query, limit),
    places,
    CACHE_DURATIONS.searchSeconds,
  );
}

/** Invalidate read caches after DB writes. Map uses a version bump. */
export async function invalidatePlaceReadCaches(placeId: string): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  await Promise.all([cacheDel(placeCacheKey(placeId)), cacheIncr(MAP_VERSION_KEY)]);
}
