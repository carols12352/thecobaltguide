import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "CobaltMerchantMap/1.0 (community import; contact: local-dev)";
const CACHE_PATH = path.join(process.cwd(), "data", "geocode-cache.json");

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

type GeocodeCache = Record<string, GeocodeResult | null>;

let cache: GeocodeCache | null = null;
let lastRequestAt = 0;

function loadCache(): GeocodeCache {
  if (cache) return cache;
  if (existsSync(CACHE_PATH)) {
    cache = JSON.parse(readFileSync(CACHE_PATH, "utf-8")) as GeocodeCache;
    return cache;
  }
  cache = {};
  return cache;
}

function saveCache() {
  if (!cache) return;
  const dir = path.dirname(CACHE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function rateLimit() {
  const minIntervalMs = 1100;
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < minIntervalMs) {
    await new Promise((r) => setTimeout(r, minIntervalMs - elapsed));
  }
  lastRequestAt = Date.now();
}

async function nominatimSearch(query: string): Promise<GeocodeResult | null> {
  await rateLimit();

  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ca");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) return null;

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  const hit = results[0];
  if (!hit) return null;

  return {
    latitude: parseFloat(hit.lat),
    longitude: parseFloat(hit.lon),
    displayName: hit.display_name,
  };
}

export async function geocodeMerchantLocation(params: {
  merchant: string;
  city: string;
  provinceName: string;
  mode?: "precise" | "city";
}): Promise<GeocodeResult | null> {
  const store = loadCache();
  const mode = params.mode ?? "precise";
  const cacheKey =
    mode === "city"
      ? `city:${params.city}|${params.provinceName}`
      : `precise:${params.merchant}|${params.city}|${params.provinceName}`;

  if (cacheKey in store) {
    return store[cacheKey];
  }

  const queries =
    mode === "precise"
      ? [
          `${params.merchant}, ${params.city}, ${params.provinceName}, Canada`,
          `${params.city}, ${params.provinceName}, Canada`,
        ]
      : [`${params.city}, ${params.provinceName}, Canada`];

  let result: GeocodeResult | null = null;
  for (const query of queries) {
    result = await nominatimSearch(query);
    if (result) break;
  }

  store[cacheKey] = result;
  saveCache();
  return result;
}

/** Pre-geocode unique cities for bulk city-mode imports. */
export async function preloadCityGeocodes(
  places: Array<{ city: string; provinceName: string }>,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const unique = new Map<string, { city: string; provinceName: string }>();
  for (const place of places) {
    const key = `${place.city}|${place.provinceName}`;
    unique.set(key, place);
  }

  const entries = [...unique.values()];
  let done = 0;
  for (const entry of entries) {
    await geocodeMerchantLocation({
      merchant: "",
      city: entry.city,
      provinceName: entry.provinceName,
      mode: "city",
    });
    done++;
    onProgress?.(done, entries.length);
  }
}

export function flushGeocodeCache() {
  saveCache();
}
