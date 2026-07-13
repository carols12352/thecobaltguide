import { DEFAULT_CARD_SLUG } from "@/config/constants";
import { normalizeMerchantName } from "@/lib/utils";

const MAP_VERSION_KEY = "cobalt:cache:map-version";
const SEARCH_VERSION_KEY = "cobalt:cache:search-version";

export function mapCacheKey(
  version: number,
  params: {
    gridKey: string;
    zoom?: number;
    multiplier?: number;
    category?: string;
    card?: string;
  },
): string {
  const parts = [
    "cobalt:cache:map:v1",
    version,
    "grid",
    params.gridKey,
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

export function cityCountCacheKey(
  version: number,
  params: {
    city: string;
    province: string;
    multiplier?: number;
    category?: string;
    card?: string;
  },
): string {
  const city = params.city.trim().toLowerCase();
  const province = params.province.trim().toUpperCase();
  return [
    "cobalt:cache:city-count:v1",
    version,
    province,
    city,
    params.multiplier ?? "all",
    params.category ?? "all",
    params.card ?? DEFAULT_CARD_SLUG,
  ].join(":");
}

export function cityMapCacheKey(
  version: number,
  params: {
    city: string;
    province: string;
    multiplier?: number;
    category?: string;
    card?: string;
  },
): string {
  const city = params.city.trim().toLowerCase();
  const province = params.province.trim().toUpperCase();
  return [
    "cobalt:cache:city-map:v1",
    version,
    province,
    city,
    params.multiplier ?? "all",
    params.category ?? "all",
    params.card ?? DEFAULT_CARD_SLUG,
  ].join(":");
}

export function cityResolveCacheKey(version: number, gridKey: string): string {
  return ["cobalt:cache:city-resolve:v1", version, gridKey].join(":");
}

export function viewportDetailsCacheKey(
  version: number,
  params: {
    viewGridKey: string;
    zoom?: number;
    gridTruncated?: boolean;
    multiplier?: number;
    category?: string;
    card?: string;
  },
): string {
  return [
    "cobalt:cache:viewport-details:v1",
    version,
    params.viewGridKey,
    params.zoom ?? "all",
    params.gridTruncated ? "trunc" : "full",
    params.multiplier ?? "all",
    params.category ?? "all",
    params.card ?? DEFAULT_CARD_SLUG,
  ].join(":");
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
    placeId?: string;
    name?: string;
    postalCode?: string;
    addressLine1?: string;
    status?: string;
    page: number;
    pageSize: number;
  },
): string {
  const name = params.name ? normalizeAdminQuery(params.name) : "-";
  const postal = params.postalCode ? normalizeAdminQuery(params.postalCode) : "-";
  const address = params.addressLine1
    ? normalizeAdminQuery(params.addressLine1)
    : "-";
  const placeId = params.placeId ?? "-";
  const status = params.status ?? "all";
  return `cobalt:cache:admin:v1:${version}:places:${name}:${postal}:${address}:${placeId}:${status}:${params.page}:${params.pageSize}`;
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

export function userAccountVersionKey(userId: string): string {
  return `cobalt:cache:user-account-version:${userId}`;
}

export function userAccountReportsCacheKey(
  version: number,
  userId: string,
  params: {
    view: string;
    page: number;
    pageSize: number;
  },
): string {
  return [
    "cobalt:cache:user-account:v1",
    version,
    userId,
    "reports",
    params.view,
    params.page,
    params.pageSize,
  ].join(":");
}

export function userAccountFlagsCacheKey(
  version: number,
  userId: string,
  params: {
    view: string;
    page: number;
    pageSize: number;
  },
): string {
  return [
    "cobalt:cache:user-account:v1",
    version,
    userId,
    "flags",
    params.view,
    params.page,
    params.pageSize,
  ].join(":");
}

export { MAP_VERSION_KEY, SEARCH_VERSION_KEY, ADMIN_VERSION_KEY };
