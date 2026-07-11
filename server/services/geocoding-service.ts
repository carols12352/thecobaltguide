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

/**
 * Geocoding service — calls external provider (Mapbox / Google Places).
 * Requires MAPBOX_ACCESS_TOKEN or GOOGLE_PLACES_API_KEY in environment.
 */
export class GeocodingService {
  async searchAddress(query: string): Promise<GeocodingResult[]> {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
      throw new GeocodingNotConfiguredError(
        "MAPBOX_ACCESS_TOKEN is not configured",
      );
    }

    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("country", "ca");
    url.searchParams.set("types", "poi,address");
    url.searchParams.set("limit", "5");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status}`);
    }

    const data = await response.json();
    return (data.features ?? []).map(
      (feature: {
        id: string;
        text: string;
        place_name: string;
        center: [number, number];
        context?: Array<{ id: string; text: string; short_code?: string }>;
      }) => {
        const ctx = feature.context ?? [];
        const city = ctx.find((c) => c.id.startsWith("place."))?.text ?? "";
        const province =
          ctx.find((c) => c.id.startsWith("region."))?.short_code?.replace("CA-", "") ?? "";
        const postalCode =
          ctx.find((c) => c.id.startsWith("postcode."))?.text ?? "";

        return {
          name: feature.text,
          addressLine1: feature.place_name.split(",")[0] ?? feature.text,
          city,
          province,
          postalCode,
          countryCode: "CA",
          latitude: feature.center[1],
          longitude: feature.center[0],
          externalPlaceId: feature.id,
        };
      },
    );
  }
}

export class GeocodingNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodingNotConfiguredError";
  }
}

export const geocodingService = new GeocodingService();
