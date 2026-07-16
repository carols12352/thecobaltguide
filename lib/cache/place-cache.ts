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
  cityCountCacheKey,
  cityMapCacheKey,
  cityResolveCacheKey,
  mapCacheKey,
  placeCacheKey,
  searchCacheKey,
  viewportDetailsCacheKey,
} from "@/lib/cache/keys";
import type { MapCitySummary, MapPlace, PlaceDetail } from "@/types/domain";

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
): Promise<{
  places: MapPlace[];
  truncated: boolean;
  citySummary?: MapCitySummary | null;
} | null> {
  const version = await getMapCacheVersion();
  if (version === 0) return null;

  return cacheGet(mapCacheKey(version, params));
}

export async function setCachedMapPlaces(
  params: Parameters<typeof mapCacheKey>[1],
  value: {
    places: MapPlace[];
    truncated: boolean;
    citySummary?: MapCitySummary | null;
  },
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getMapCacheVersionForWrite();

  await cacheSet(
    mapCacheKey(version, params),
    value,
    CACHE_DURATIONS.mapRegionSeconds,
  );
}

export async function getCachedCityCount(
  params: Parameters<typeof cityCountCacheKey>[1],
): Promise<MapCitySummary | null> {
  const version = await getMapCacheVersion();
  if (version === 0) return null;
  return cacheGet<MapCitySummary>(cityCountCacheKey(version, params));
}

export async function setCachedCityCount(
  params: Parameters<typeof cityCountCacheKey>[1],
  value: MapCitySummary,
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getMapCacheVersionForWrite();
  await cacheSet(
    cityCountCacheKey(version, params),
    value,
    CACHE_DURATIONS.mapRegionSeconds,
  );
}

export async function getCachedCityMap(
  params: Parameters<typeof cityMapCacheKey>[1],
): Promise<{
  places: MapPlace[];
  citySummary: MapCitySummary;
  truncated: boolean;
} | null> {
  const version = await getMapCacheVersion();
  if (version === 0) return null;
  return cacheGet(cityMapCacheKey(version, params));
}

export async function setCachedCityMap(
  params: Parameters<typeof cityMapCacheKey>[1],
  value: {
    places: MapPlace[];
    citySummary: MapCitySummary;
    truncated: boolean;
  },
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getMapCacheVersionForWrite();
  await cacheSet(
    cityMapCacheKey(version, params),
    value,
    CACHE_DURATIONS.mapRegionSeconds,
  );
}

export async function getCachedCityResolve(
  gridKey: string,
): Promise<{ city: string; province: string } | null> {
  const version = await getMapCacheVersion();
  if (version === 0) return null;
  return cacheGet(cityResolveCacheKey(version, gridKey));
}

export async function setCachedCityResolve(
  gridKey: string,
  value: { city: string; province: string },
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getMapCacheVersionForWrite();
  await cacheSet(
    cityResolveCacheKey(version, gridKey),
    value,
    CACHE_DURATIONS.mapRegionSeconds,
  );
}

export async function getCachedViewportDetails(
  params: Parameters<typeof viewportDetailsCacheKey>[1],
): Promise<{
  viewportCount: number | null;
  listPlaces: MapPlace[] | null;
  citySummary?: MapCitySummary | null;
} | null> {
  const version = await getMapCacheVersion();
  if (version === 0) return null;
  return cacheGet(viewportDetailsCacheKey(version, params));
}

export async function setCachedViewportDetails(
  params: Parameters<typeof viewportDetailsCacheKey>[1],
  value: {
    viewportCount: number | null;
    listPlaces: MapPlace[] | null;
    citySummary?: MapCitySummary | null;
  },
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getMapCacheVersionForWrite();
  await cacheSet(
    viewportDetailsCacheKey(version, params),
    value,
    CACHE_DURATIONS.mapViewportDetailsSeconds,
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
export async function invalidatePlaceReadCaches(placeId: string): Promise<boolean> {
  if (!isRedisWriteConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[redis] place cache not invalidated — missing write token");
    }
    return false;
  }

  const [, mapVersion, searchVersion] = await Promise.all([
    cacheDel(placeCacheKey(placeId)),
    cacheBumpVersion(MAP_VERSION_KEY),
    cacheBumpVersion(SEARCH_VERSION_KEY),
  ]);
  return mapVersion > 0 && searchVersion > 0;
}
