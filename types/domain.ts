export type UserRole = "user" | "moderator" | "admin";
export type UserStatus = "active" | "suspended";
export type PlaceStatus = "active" | "permanently_closed" | "merged";
export type ReportStatus = "active" | "removed" | "flagged";
export type ReportKind = "new_location" | "error" | "update" | "confirm";
export type FlagReason =
  | "duplicate"
  | "wrong_address"
  | "permanently_closed"
  | "does_not_accept_amex"
  | "incorrect_category"
  | "other";
export type FlagStatus = "open" | "resolved" | "dismissed";
export type PaymentContext =
  | "in_store"
  | "online"
  | "gas_pump"
  | "delivery"
  | "other";
export type ConfidenceLevel =
  | "insufficient"
  | "disputed"
  | "medium"
  | "high"
  | "recently_confirmed";
export type MultiplierValue = 1 | 2 | 3 | 5;

export interface MapCitySummary {
  count: number;
  city?: string;
  province?: string;
}

export interface MapPlace {
  id: string;
  name: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  latitude: number;
  longitude: number;
  multiplier: MultiplierValue | null;
  confidenceLevel: ConfidenceLevel;
  recentReportCount: number;
  lastReportedAt: string | null;
  category?: string;
  distanceMetres?: number;
}

export interface MapPlacesResponse {
  places: MapPlace[];
  truncated: boolean;
  citySummary?: MapCitySummary | null;
  viewportCount?: number | null;
  listPlaces?: MapPlace[] | null;
}

export interface PlaceDetail {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
  category: string;
  acceptsAmex: boolean | null;
  latitude: number;
  longitude: number;
  status: PlaceStatus;
  brandId: string | null;
  brandName: string | null;
  summary: PlaceSummary | null;
}

export interface PlaceSummary {
  currentMultiplier: MultiplierValue | null;
  confidenceScore: number | null;
  confidenceLevel: ConfidenceLevel;
  recentReportCount: number;
  uniqueReporterCount: number;
  lastReportedAt: string | null;
  score1x: number;
  score2x: number;
  score3x: number;
  score5x: number;
}

/** Moderator-only place payload with internal metadata. */
export interface AdminPlaceDetail extends PlaceDetail {
  normalizedName: string;
  externalPlaceId: string | null;
  createdBy: string | null;
  createdByUsername: string | null;
  createdAt: string;
  updatedAt: string;
  cardProductId: string;
  openFlagCount: number;
  flags: AdminPlaceFlag[];
}

export interface AdminPlaceFlag {
  id: string;
  reason: string;
  details: string | null;
  status: FlagStatus;
  createdAt: string;
  resolvedAt: string | null;
  reporterUsername: string | null;
  reviewedByUsername: string | null;
}

export interface MultiplierReport {
  id: string;
  placeId: string;
  userId: string;
  cardProductId: string;
  multiplier: MultiplierValue;
  transactionDate: string;
  paymentContext: PaymentContext;
  notes: string | null;
  status: ReportStatus;
  reportKind: ReportKind;
  createdAt: string;
}

export interface CardProduct {
  id: string;
  issuer: string;
  productName: string;
  slug: string;
  countryCode: string;
  active: boolean;
}

export interface UserProfile {
  id: string;
  username: string | null;
  role: UserRole;
  reputationScore: number;
  reportCount: number;
  status: UserStatus;
}

export interface AggregationInput {
  multiplier: MultiplierValue;
  transactionDate: string;
  userId: string;
  status: ReportStatus;
}

export interface AggregationResult {
  currentMultiplier: MultiplierValue | null;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  recentReportCount: number;
  uniqueReporterCount: number;
  lastReportedAt: string | null;
  score1x: number;
  score2x: number;
  score3x: number;
  score5x: number;
}

export interface GeocodingResult {
  name: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  externalPlaceId: string;
}
