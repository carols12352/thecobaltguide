import { CACHE_DURATIONS } from "@/config/constants";
import {
  cacheGet,
  cacheGetVersion,
  cacheBumpVersion,
  cacheSet,
  isRedisReadConfigured,
  isRedisWriteConfigured,
} from "@/lib/cache/redis";
import {
  ADMIN_VERSION_KEY,
  adminFlagsCacheKey,
  adminPlaceDetailCacheKey,
  adminPlacesCacheKey,
  adminReportsCacheKey,
  adminUserCacheKey,
  adminUsersCacheKey,
} from "@/lib/cache/keys";
import type { AdminPlaceDetail } from "@/types/domain";

async function getAdminCacheVersion(): Promise<number> {
  if (!isRedisReadConfigured() && !isRedisWriteConfigured()) return 0;
  return cacheGetVersion(ADMIN_VERSION_KEY);
}

async function getAdminCacheVersionForWrite(): Promise<number> {
  if (!isRedisReadConfigured() && !isRedisWriteConfigured()) return 1;
  const version = await cacheGetVersion(ADMIN_VERSION_KEY);
  return version || 1;
}

export async function invalidateAdminCaches(): Promise<void> {
  if (!isRedisWriteConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[redis] admin cache not invalidated — missing write token");
    }
    return;
  }
  const next = await cacheBumpVersion(ADMIN_VERSION_KEY);
  if (next === 0 && process.env.NODE_ENV === "development") {
    console.warn("[redis] admin cache version bump failed");
  }
}

export async function getCachedAdminReports<T>(limit: number): Promise<T | null> {
  const version = await getAdminCacheVersion();
  if (version === 0) return null;
  return cacheGet<T>(adminReportsCacheKey(version, limit));
}

export async function setCachedAdminReports<T>(
  limit: number,
  value: T,
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getAdminCacheVersionForWrite();
  await cacheSet(
    adminReportsCacheKey(version, limit),
    value,
    CACHE_DURATIONS.adminListSeconds,
  );
}

export async function getCachedAdminFlags<T>(limit: number): Promise<T | null> {
  const version = await getAdminCacheVersion();
  if (version === 0) return null;
  return cacheGet<T>(adminFlagsCacheKey(version, limit));
}

export async function setCachedAdminFlags<T>(limit: number, value: T): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getAdminCacheVersionForWrite();
  await cacheSet(
    adminFlagsCacheKey(version, limit),
    value,
    CACHE_DURATIONS.adminListSeconds,
  );
}

export async function getCachedAdminPlacesSearch<T>(
  params: {
    query?: string;
    status?: string;
    page: number;
    pageSize: number;
  },
): Promise<T | null> {
  const version = await getAdminCacheVersion();
  if (version === 0) return null;
  return cacheGet<T>(adminPlacesCacheKey(version, params));
}

export async function setCachedAdminPlacesSearch<T>(
  params: {
    query?: string;
    status?: string;
    page: number;
    pageSize: number;
  },
  value: T,
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getAdminCacheVersionForWrite();
  await cacheSet(
    adminPlacesCacheKey(version, params),
    value,
    CACHE_DURATIONS.adminListSeconds,
  );
}

export async function getCachedAdminUsers<T>(limit: number): Promise<T | null> {
  const version = await getAdminCacheVersion();
  if (version === 0) return null;
  return cacheGet<T>(adminUsersCacheKey(version, limit));
}

export async function setCachedAdminUsers<T>(limit: number, value: T): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getAdminCacheVersionForWrite();
  await cacheSet(
    adminUsersCacheKey(version, limit),
    value,
    CACHE_DURATIONS.adminListSeconds,
  );
}

export async function getCachedAdminUser<T>(userId: string): Promise<T | null> {
  const version = await getAdminCacheVersion();
  if (version === 0) return null;
  return cacheGet<T>(adminUserCacheKey(version, userId));
}

export async function setCachedAdminUser<T>(
  userId: string,
  value: T,
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getAdminCacheVersionForWrite();
  await cacheSet(
    adminUserCacheKey(version, userId),
    value,
    CACHE_DURATIONS.adminListSeconds,
  );
}

export async function getCachedAdminPlaceDetail(
  placeId: string,
): Promise<AdminPlaceDetail | null> {
  const version = await getAdminCacheVersion();
  if (version === 0) return null;
  return cacheGet<AdminPlaceDetail>(adminPlaceDetailCacheKey(version, placeId));
}

export async function setCachedAdminPlaceDetail(
  place: AdminPlaceDetail,
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getAdminCacheVersionForWrite();
  await cacheSet(
    adminPlaceDetailCacheKey(version, place.id),
    place,
    CACHE_DURATIONS.adminPlaceDetailSeconds,
  );
}
