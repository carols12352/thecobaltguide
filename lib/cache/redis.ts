import { Redis } from "@upstash/redis";

let redisReadClient: Redis | null | undefined;
let redisWriteClient: Redis | null | undefined;

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

/** Read-only REST token from Upstash. Falls back to UPSTASH_REDIS_REST_TOKEN for local dev. */
function getReadToken(): string | undefined {
  return (
    process.env.UPSTASH_REDIS_REST_READONLY_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/** Full REST token from Upstash — used for SET/DEL/INCR. */
function getWriteToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

function createRedisClient(token: string | undefined): Redis | null {
  const url = getRedisUrl();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function isRedisReadConfigured(): boolean {
  return Boolean(getRedisUrl() && getReadToken());
}

export function isRedisWriteConfigured(): boolean {
  return Boolean(getRedisUrl() && getWriteToken());
}

export function isRedisConfigured(): boolean {
  return isRedisReadConfigured() || isRedisWriteConfigured();
}

export function getRedisRead(): Redis | null {
  if (redisReadClient !== undefined) return redisReadClient;

  redisReadClient = createRedisClient(getReadToken());
  return redisReadClient;
}

export function getRedisWrite(): Redis | null {
  if (redisWriteClient !== undefined) return redisWriteClient;

  redisWriteClient = createRedisClient(getWriteToken());
  return redisWriteClient;
}

function logRedisError(op: string, error: unknown): void {
  if (process.env.NODE_ENV !== "development") return;
  console.warn(`[redis] ${op} failed:`, error);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisRead();
  if (!redis) return null;

  try {
    return (await redis.get<T>(key)) ?? null;
  } catch (error) {
    logRedisError(`GET ${key}`, error);
    return null;
  }
}

/** Read a cache version key from the write client when available to avoid read-replica lag. */
export async function cacheGetVersion(key: string): Promise<number> {
  if (!isRedisReadConfigured() && !isRedisWriteConfigured()) return 0;

  const redis = getRedisWrite() ?? getRedisRead();
  if (!redis) return 0;

  try {
    const version = await redis.get<number>(key);
    return version ?? 1;
  } catch (error) {
    logRedisError(`GET version ${key}`, error);
    return 0;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const redis = getRedisWrite();
  if (!redis) return;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    logRedisError(`SET ${key}`, error);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedisWrite();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    logRedisError(`DEL ${key}`, error);
  }
}

export async function cacheBumpVersion(key: string): Promise<number> {
  const redis = getRedisWrite();
  if (!redis) return 0;

  try {
    // INCR on a missing key starts at 1, which matches our default read version and
    // would not invalidate anything. Seed with 1 so the subsequent INCR always bumps.
    await redis.set(key, 1, { nx: true });
    const next = await redis.incr(key);
    if (process.env.NODE_ENV === "development") {
      console.info(`[redis] bumped ${key} -> ${next}`);
    }
    return next;
  } catch (error) {
    logRedisError(`BUMP ${key}`, error);
    return 0;
  }
}

/** @deprecated Use cacheBumpVersion for cache version keys. */
export async function cacheIncr(key: string): Promise<void> {
  await cacheBumpVersion(key);
}

if (process.env.NODE_ENV === "development") {
  const read = isRedisReadConfigured();
  const write = isRedisWriteConfigured();
  if (read && write) {
    console.info("[redis] cache enabled (read + write tokens)");
  } else if (read || write) {
    console.warn(
      `[redis] cache partially configured (read=${read}, write=${write}) — set both UPSTASH_REDIS_REST_TOKEN and UPSTASH_REDIS_REST_READONLY_TOKEN`,
    );
  } else {
    console.info(
      "[redis] cache disabled — requests go straight to Supabase",
    );
  }
}
