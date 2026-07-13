export const DEFAULT_CARD_SLUG = "amex-cobalt-ca";

export const MULTIPLIER_OPTIONS = [1, 2, 3, 5] as const;

export const CONFIDENCE_LEVELS = [
  "insufficient",
  "disputed",
  "medium",
  "high",
  "recently_confirmed",
] as const;

export const RATE_LIMITS = {
  maxReportsPerUserPerDay: 20,
  maxPlacesPerUserPerDay: 5,
  maxWriteRequestsPerIpPerHour: 50,
  oneReportPerPlacePerDay: true,
} as const;

export const MAP_DEFAULTS = {
  defaultZoom: 13,
  /** In-view list only at neighborhood zoom; wider views show clustered merchants. */
  minInViewZoom: 13,
  maxResults: 200,
  /** Max places loaded for cluster dots across the current wide viewport. */
  cityMapClusterLimit: 500,
  /** Radius used by legacy city lookup helpers outside the viewport map flow. */
  cityResolveRadiusMetres: 80_000,
  /** Re-sort the merchant list when the map center moves this far with the same places. */
  listResortDistanceMetres: 150,
  /** Debounce before fetching new grid data after the map stops moving. */
  mapFetchDebounceMs: 120,
  /** Throttle local list updates while the map is being dragged. */
  mapLocalSyncThrottleMs: 80,
  debounceMs: 120,
  clusterZoomThreshold: 12,
  nearbyRadiusMetres: 5000,
} as const;

/** Redis / application cache TTLs. */
export const CACHE_DURATIONS = {
  placeDetailsSeconds: 86400,
  mapRegionSeconds: 86400,
  /** Short TTL for per-viewport count/list supplements. */
  mapViewportDetailsSeconds: 300,
  searchSeconds: 300,
  brandCategorySeconds: 86400,
  adminListSeconds: 120,
  adminPlaceDetailSeconds: 120,
} as const;

/** CDN edge cache TTLs — short so Redis version bumps propagate quickly. */
export const CDN_CACHE_DURATIONS = {
  mapRegionSeconds: 120,
  mapViewportDetailsSeconds: 60,
  placeDetailsSeconds: 120,
  searchSeconds: 120,
  staleWhileRevalidateSeconds: 60,
} as const;

export const DUPLICATE_DETECTION = {
  maxDistanceMetres: 30,
  nameSimilarityThreshold: 0.8,
} as const;

export const RECENCY_WEIGHTS = {
  days0to30: 1.0,
  days31to90: 0.5,
  days91to180: 0.2,
  excludeAfterDays: 180,
} as const;

export const CONFIDENCE_THRESHOLDS = {
  disputedBelow: 0.6,
  mediumBelow: 0.8,
  highMinUniqueReporters: 3,
  recentlyConfirmedDays: 30,
  recentlyConfirmedMinReports: 2,
} as const;

export const AUTH_EMAIL_COOLDOWN_SECONDS = 60;
