import { CACHE_DURATIONS } from "@/config/constants";
import {
  cacheBumpVersion,
  cacheGet,
  cacheGetVersion,
  cacheSet,
  isRedisReadConfigured,
  isRedisWriteConfigured,
} from "@/lib/cache/redis";
import {
  userAccountFlagsCacheKey,
  userAccountReportsCacheKey,
  userAccountVersionKey,
} from "@/lib/cache/keys";

type UserAccountListParams = {
  view: string;
  page: number;
  pageSize: number;
};

async function getUserAccountCacheVersion(userId: string): Promise<number> {
  if (!isRedisReadConfigured() && !isRedisWriteConfigured()) return 0;
  return cacheGetVersion(userAccountVersionKey(userId));
}

async function getUserAccountCacheVersionForWrite(
  userId: string,
): Promise<number> {
  if (!isRedisReadConfigured() && !isRedisWriteConfigured()) return 1;
  const version = await cacheGetVersion(userAccountVersionKey(userId));
  return version || 1;
}

export async function invalidateUserAccountCaches(userId: string): Promise<void> {
  if (!isRedisWriteConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[redis] user account cache not invalidated — missing write token",
      );
    }
    return;
  }

  const next = await cacheBumpVersion(userAccountVersionKey(userId));
  if (next === 0 && process.env.NODE_ENV === "development") {
    console.warn("[redis] user account cache version bump failed");
  }
}

export async function getCachedUserAccountReports<T>(
  userId: string,
  params: UserAccountListParams,
): Promise<T | null> {
  const version = await getUserAccountCacheVersion(userId);
  if (version === 0) return null;
  return cacheGet<T>(userAccountReportsCacheKey(version, userId, params));
}

export async function setCachedUserAccountReports<T>(
  userId: string,
  params: UserAccountListParams,
  value: T,
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getUserAccountCacheVersionForWrite(userId);
  await cacheSet(
    userAccountReportsCacheKey(version, userId, params),
    value,
    CACHE_DURATIONS.userAccountListSeconds,
  );
}

export async function getCachedUserAccountFlags<T>(
  userId: string,
  params: UserAccountListParams,
): Promise<T | null> {
  const version = await getUserAccountCacheVersion(userId);
  if (version === 0) return null;
  return cacheGet<T>(userAccountFlagsCacheKey(version, userId, params));
}

export async function setCachedUserAccountFlags<T>(
  userId: string,
  params: UserAccountListParams,
  value: T,
): Promise<void> {
  if (!isRedisWriteConfigured()) return;

  const version = await getUserAccountCacheVersionForWrite(userId);
  await cacheSet(
    userAccountFlagsCacheKey(version, userId, params),
    value,
    CACHE_DURATIONS.userAccountListSeconds,
  );
}
