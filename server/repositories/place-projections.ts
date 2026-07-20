import { parseGeoLocation } from "@/lib/map/parse-location";
import type {
  AdminPlaceDetail,
  MapPlace,
  PlaceDetail,
  PlaceSummary,
} from "@/types/domain";

type SummaryRow = {
  card_product_id?: string;
  current_multiplier?: string;
  confidence_level?: MapPlace["confidenceLevel"];
  confidence_score?: number | null;
  recent_report_count?: number;
  unique_reporter_count?: number;
  last_reported_at?: string | null;
  score_1x?: number | string;
  score_2x?: number | string;
  score_3x?: number | string;
  score_5x?: number | string;
};

function coordinates(location: unknown) {
  return parseGeoLocation(location) ?? { latitude: 0, longitude: 0 };
}

function multiplier(value: unknown): MapPlace["multiplier"] {
  return value ? (parseInt(value as string, 10) as MapPlace["multiplier"]) : null;
}

export function projectViewportPlace(row: Record<string, unknown>): MapPlace {
  return {
    id: row.id as string,
    name: row.name as string,
    addressLine1: row.address_line1 as string | undefined,
    city: row.city as string | undefined,
    province: row.province as string | undefined,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    multiplier: multiplier(row.multiplier),
    confidenceLevel: row.confidence_level as MapPlace["confidenceLevel"],
    recentReportCount: (row.recent_report_count as number) ?? 0,
    lastReportedAt: (row.last_reported_at as string) ?? null,
    category: row.category as string,
  };
}

export function projectMapPlace(
  place: Record<string, unknown>,
  cardProductId?: string,
): MapPlace {
  const raw = place.place_multiplier_summaries;
  const summaries = (Array.isArray(raw) ? raw : raw ? [raw] : []) as SummaryRow[];
  const summary = cardProductId
    ? summaries.find((entry) => entry.card_product_id === cardProductId)
    : summaries[0];
  const coords = coordinates(place.location);

  return {
    id: place.id as string,
    name: place.name as string,
    addressLine1: (place.address_line1 as string | null) ?? undefined,
    city: (place.city as string | null) ?? undefined,
    province: (place.province as string | null) ?? undefined,
    latitude: coords.latitude,
    longitude: coords.longitude,
    category: place.category as string,
    multiplier: multiplier(summary?.current_multiplier),
    confidenceLevel: summary?.confidence_level ?? "insufficient",
    recentReportCount: summary?.recent_report_count ?? 0,
    lastReportedAt: summary?.last_reported_at ?? null,
  };
}

export function projectPlaceDetail(
  place: Record<string, unknown>,
  summary: Record<string, unknown> | null,
): PlaceDetail {
  const brand = place.merchant_brands as { name: string } | null;
  const coords = coordinates(place.location);
  const placeSummary: PlaceSummary | null = summary
    ? {
        currentMultiplier: multiplier(summary.current_multiplier),
        confidenceScore: summary.confidence_score as number | null,
        confidenceLevel: summary.confidence_level as PlaceSummary["confidenceLevel"],
        recentReportCount: summary.recent_report_count as number,
        uniqueReporterCount: summary.unique_reporter_count as number,
        lastReportedAt: summary.last_reported_at as string | null,
        score1x: Number(summary.score_1x),
        score2x: Number(summary.score_2x),
        score3x: Number(summary.score_3x),
        score5x: Number(summary.score_5x),
      }
    : null;

  return {
    id: place.id as string,
    name: place.name as string,
    addressLine1: place.address_line1 as string,
    city: place.city as string,
    province: place.province as string,
    postalCode: place.postal_code as string,
    countryCode: place.country_code as string,
    category: place.category as string,
    acceptsAmex: place.accepts_amex as boolean | null,
    latitude: coords.latitude,
    longitude: coords.longitude,
    status: place.status as PlaceDetail["status"],
    brandId: place.brand_id as string | null,
    brandName: brand?.name ?? null,
    googlePlaceId: place.google_place_id as string | null,
    summary: placeSummary,
  };
}

export function projectAdminFlag(flag: Record<string, unknown>): AdminPlaceDetail["flags"][number] {
  return {
    id: flag.id as string,
    reason: flag.reason as string,
    details: flag.details as string | null,
    status: flag.status as AdminPlaceDetail["flags"][number]["status"],
    createdAt: flag.created_at as string,
    resolvedAt: flag.resolved_at as string | null,
    reporterUsername: profileUsername(flag.reporter),
    reviewedByUsername: profileUsername(flag.resolver),
  };
}

export function profileUsername(profile: unknown): string | null {
  if (!profile) return null;
  if (Array.isArray(profile)) {
    return (profile[0] as { username?: string | null } | undefined)?.username ?? null;
  }
  return (profile as { username?: string | null }).username ?? null;
}
