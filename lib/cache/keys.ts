import { DEFAULT_CARD_SLUG } from "@/config/constants";
import { normalizeMerchantName } from "@/lib/utils";

const MAP_VERSION_KEY = "cobalt:cache:map-version";
const SEARCH_VERSION_KEY = "cobalt:cache:search-version";

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

export function searchCacheKey(
  version: number,
  query: string,
  limit: number,
): string {
  return `cobalt:cache:search:v1:${version}:${normalizeMerchantName(query)}:${limit}`;
}

const ADMIN_VERSION_KEY = "cobalt:cache:admin-version";

function normalizeAdminQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function adminReportsCacheKey(version: number, limit: number): string {
  return `cobalt:cache:admin:v1:${version}:reports:${limit}`;
}

export function adminFlagsCacheKey(version: number, limit: number): string {
  return `cobalt:cache:admin:v1:${version}:flags:${limit}`;
}

export function adminPlacesCacheKey(
  version: number,
  params: {
    query?: string;
    status?: string;
    page: number;
    pageSize: number;
  },
): string {
  const query = params.query ? normalizeAdminQuery(params.query) : "all";
  const status = params.status ?? "all";
  return `cobalt:cache:admin:v1:${version}:places:${query}:${status}:${params.page}:${params.pageSize}`;
}

export function adminUsersCacheKey(version: number, limit: number): string {
  return `cobalt:cache:admin:v1:${version}:users:${limit}`;
}

export function adminUserCacheKey(version: number, userId: string): string {
  return `cobalt:cache:admin:v1:${version}:user:${userId}`;
}

export function adminPlaceDetailCacheKey(version: number, placeId: string): string {
  return `cobalt:cache:admin:v1:${version}:place-detail:${placeId}`;
}

export { MAP_VERSION_KEY, SEARCH_VERSION_KEY, ADMIN_VERSION_KEY };
