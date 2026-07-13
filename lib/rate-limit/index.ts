import { RATE_LIMITS } from "@/config/constants";
import { getRedisWrite, isRedisWriteConfigured } from "@/lib/cache/redis";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

async function checkRateLimitRedis(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redis = getRedisWrite();
  if (!redis) {
    return checkRateLimitMemory(key, limit, windowMs);
  }

  const redisKey = `cobalt:ratelimit:${key}`;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    const count = (await redis.eval(
      `local c = redis.call("INCR", KEYS[1])
       if c == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end
       return c`,
      [redisKey],
      [String(windowSec)],
    )) as number;

    const ttl = await redis.ttl(redisKey);
    const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);

    if (count > limit) {
      return { allowed: false, remaining: 0, resetAt };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  } catch {
    return checkRateLimitMemory(key, limit, windowMs);
  }
}

/** Distributed rate limit via Upstash Redis when configured; falls back to in-memory. */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (isRedisWriteConfigured()) {
    return checkRateLimitRedis(key, limit, windowMs);
  }
  return checkRateLimitMemory(key, limit, windowMs);
}

export async function checkIpWriteRateLimit(ip: string) {
  return checkRateLimit(
    `ip:${ip}`,
    RATE_LIMITS.maxWriteRequestsPerIpPerHour,
    60 * 60 * 1000,
  );
}

export async function checkUserReportRateLimit(userId: string) {
  return checkRateLimit(
    `user-reports:${userId}`,
    RATE_LIMITS.maxReportsPerUserPerDay,
    24 * 60 * 60 * 1000,
  );
}

export async function checkUserReportSubmitCooldown(userId: string) {
  return checkRateLimit(
    `user-report-submit:${userId}`,
    1,
    RATE_LIMITS.minSecondsBetweenUserReports * 1000,
  );
}

export async function checkUserPlaceRateLimit(userId: string) {
  return checkRateLimit(
    `user-places:${userId}`,
    RATE_LIMITS.maxPlacesPerUserPerDay,
    24 * 60 * 60 * 1000,
  );
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
