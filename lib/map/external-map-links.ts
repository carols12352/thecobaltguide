export const EXTERNAL_MAP_PROVIDERS = [
  { id: "google", label: "Google Maps" },
  { id: "apple", label: "Apple Maps" },
] as const;

export type ExternalMapProvider = (typeof EXTERNAL_MAP_PROVIDERS)[number]["id"];

export const EXTERNAL_MAP_ICON_URLS: Record<ExternalMapProvider, string> = {
  google: "https://cdn.simpleicons.org/googlemaps",
  apple: "https://cdn.simpleicons.org/apple/71717A",
};

export interface ExternalMapDestination {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  label?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  googlePlaceId?: string | null;
}

export interface ExternalMapLink {
  provider: ExternalMapProvider;
  label: string;
  url: string;
}

const COORDINATE_PRECISION = 6;

function formatCoordinates(
  destination: ExternalMapDestination,
): { latitude: string; longitude: string } | null {
  const { latitude, longitude } = destination;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude: latitude.toFixed(COORDINATE_PRECISION),
    longitude: longitude.toFixed(COORDINATE_PRECISION),
  };
}

export function buildExternalMapUrl(
  provider: ExternalMapProvider,
  destination: ExternalMapDestination,
): string | null {
  const coordinates = formatCoordinates(destination);
  if (!coordinates) return null;

  const { latitude, longitude } = coordinates;
  const label = destination.label?.trim().slice(0, 120);

  if (provider === "google") {
    const url = new URL("https://www.google.com/maps/search/");
    url.searchParams.set("api", "1");
    const addressQuery = [
      label,
      destination.addressLine1,
      destination.city,
      destination.province,
      destination.postalCode,
    ]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ")
      .slice(0, 500);
    url.searchParams.set(
      "query",
      destination.googlePlaceId?.trim()
        ? `${latitude},${longitude}`
        : addressQuery || `${latitude},${longitude}`,
    );
    const googlePlaceId = destination.googlePlaceId?.trim().slice(0, 255);
    if (googlePlaceId) url.searchParams.set("query_place_id", googlePlaceId);
    return url.toString();
  }

  if (provider === "apple") {
    const url = new URL("https://maps.apple.com/");
    url.searchParams.set("ll", `${latitude},${longitude}`);
    if (label) url.searchParams.set("q", label);
    return url.toString();
  }

  return null;
}

export function buildExternalMapLinks(
  destination: ExternalMapDestination,
): ExternalMapLink[] {
  return EXTERNAL_MAP_PROVIDERS.flatMap((provider) => {
    const url = buildExternalMapUrl(provider.id, destination);
    return url ? [{ provider: provider.id, label: provider.label, url }] : [];
  });
}
