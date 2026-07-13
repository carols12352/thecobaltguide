import { CACHE_DURATIONS } from "@/config/constants";
import {
  cacheDel,
  cacheGet,
  cacheGetVersion,
  cacheBumpVersion,
  cacheSet,
  isRedisReadConfigured,
  isRedisWriteConfigured,
} from "@/lib/cache/redis";
import {
  MAP_VERSION_KEY,
  SEARCH_VERSION_KEY,
  mapCacheKey,
  placeCacheKey,
  searchCacheKey,
} from "@/lib/cache/keys";
import type { MapPlace, PlaceDetail } from "@/types/domain";

export async function getMapCacheVersion(): Promise<number> {
  if (!isRedisReadConfigured() && !isRedisWriteConfigured()) return 0;
  return cacheGetVersion(MAP_VERSION_KEY);
}

async function getMapCacheVersionForWrite(): Promise<number> {
  if (!isRedisReadConfigured() && !isRedisWriteConfigured()) return 1;
  const version = await cacheGetVersion(MAP_VERSION_KEY);
  return version || 1;
}

async function getSearchCacheVersion(): Promise<number> {
  if (!isRedisReadConfigured() && !isRedisWriteConfigured()) return 0;
  return cacheGetVersion(SEARCH_VERSION_KEY);
}

async function getSearchCacheVersionForWrite(): Promise<number> {
  if (!isRedisReadConfigured() && !isRedisWriteConfigured()) return 1;
  const version = await cacheGetVersion(SEARCH_VERSION_KEY);
  return version || 1;
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
  const version = await getSearchCacheVersion();
  if (version === 0) return null;
  return cacheGet<MapPlace[]>(searchCacheKey(version, query, limit));
}

export async function setCachedSearch(
  query: string,
  limit: number,
  places: MapPlace[],
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getSearchCacheVersionForWrite();
  await cacheSet(
    searchCacheKey(version, query, limit),
    places,
    CACHE_DURATIONS.searchSeconds,
  );
}

/** Invalidate read caches after DB writes. Map and search use version bumps. */
export async function invalidatePlaceReadCaches(placeId: string): Promise<void> {
  if (!isRedisWriteConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[redis] place cache not invalidated — missing write token");
    }
    return;
  }

  await Promise.all([
    cacheDel(placeCacheKey(placeId)),
    cacheBumpVersion(MAP_VERSION_KEY),
    cacheBumpVersion(SEARCH_VERSION_KEY),
  ]);
}
