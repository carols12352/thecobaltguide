import { DEFAULT_CARD_SLUG } from "@/config/constants";
import { normalizeMerchantName } from "@/lib/utils";

const MAP_VERSION_KEY = "cobalt:cache:map-version";

function roundCoord(value: number): string {
  return value.toFixed(3);
}

export function mapCacheKey(
  version: number,
  params: {
    north: number;
    south: number;
    east: number;
    west: number;
    zoom?: number;
    multiplier?: number;
    category?: string;
    card?: string;
  },
): string {
  const parts = [
    "cobalt:cache:map:v1",
    version,
    roundCoord(params.north),
    roundCoord(params.south),
    roundCoord(params.east),
    roundCoord(params.west),
    params.zoom ?? "all",
    params.multiplier ?? "all",
    params.category ?? "all",
    params.card ?? DEFAULT_CARD_SLUG,
  ];
  return parts.join(":");
}

export function placeCacheKey(placeId: string): string {
  return `cobalt:cache:place:v1:${placeId}`;
}

export function searchCacheKey(query: string, limit: number): string {
  return `cobalt:cache:search:v1:${normalizeMerchantName(query)}:${limit}`;
}

export { MAP_VERSION_KEY };
