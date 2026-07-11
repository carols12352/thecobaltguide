export const DEFAULT_CARD_SLUG = "amex-cobalt-ca";

export const MULTIPLIER_OPTIONS = [1, 2, 3, 5] as const;

export const RATE_LIMITS = {
  maxReportsPerUserPerDay: 20,
  maxPlacesPerUserPerDay: 5,
  maxWriteRequestsPerIpPerHour: 50,
  oneReportPerPlacePerDay: true,
} as const;

export const MAP_DEFAULTS = {
  defaultZoom: 13,
  maxResults: 200,
  debounceMs: 400,
  clusterZoomThreshold: 12,
  nearbyRadiusMetres: 5000,
} as const;

export const CACHE_DURATIONS = {
  placeDetailsSeconds: 86400,
  mapRegionSeconds: 86400,
  searchSeconds: 300,
  brandCategorySeconds: 86400,
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
