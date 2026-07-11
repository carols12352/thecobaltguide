import { RATE_LIMITS } from "@/config/constants";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Phase-one in-memory rate limiter.
 * Replace with Upstash Redis in production multi-instance deployments.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export function checkIpWriteRateLimit(ip: string) {
  return checkRateLimit(
    `ip:${ip}`,
    RATE_LIMITS.maxWriteRequestsPerIpPerHour,
    60 * 60 * 1000,
  );
}

export function checkUserReportRateLimit(userId: string) {
  return checkRateLimit(
    `user-reports:${userId}`,
    RATE_LIMITS.maxReportsPerUserPerDay,
    24 * 60 * 60 * 1000,
  );
}

export function checkUserPlaceRateLimit(userId: string) {
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
