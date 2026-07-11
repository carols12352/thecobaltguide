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

export async function cacheIncr(key: string): Promise<void> {
  const redis = getRedisWrite();
  if (!redis) return;

  try {
    await redis.incr(key);
  } catch (error) {
    logRedisError(`INCR ${key}`, error);
  }
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
