import type { GeocodingResult } from "@/types/domain";

export class GeocodingService {
  async searchAddress(query: string): Promise<GeocodingResult[]> {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (token) {
      return this.searchMapbox(query, token);
    }

    return this.searchNominatim(query);
  }

  async geocodeStructuredAddress(input: {
    name?: string;
    addressLine1: string;
    city: string;
    province: string;
    postalCode: string;
  }): Promise<GeocodingResult[]> {
    const parts = [
      input.name,
      input.addressLine1,
      input.city,
      input.province,
      input.postalCode,
      "Canada",
    ].filter(Boolean);

    return this.searchAddress(parts.join(", "));
  }

  private async searchMapbox(
    query: string,
    token: string,
  ): Promise<GeocodingResult[]> {
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

  private async searchNominatim(query: string): Promise<GeocodingResult[]> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "ca");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "CobaltMerchantMap/1.0 (merchant submit geocoding)",
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status}`);
    }

    const results = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: {
        road?: string;
        house_number?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        postcode?: string;
      };
    }>;

    return results.map((hit, index) => {
      const address = hit.address ?? {};
      const street = [address.house_number, address.road].filter(Boolean).join(" ");
      const city =
        address.city ?? address.town ?? address.village ?? "";

      return {
        name: street || hit.display_name.split(",")[0] || "Location",
        addressLine1: street || hit.display_name.split(",")[0] || "",
        city,
        province: address.state ?? "",
        postalCode: address.postcode ?? "",
        countryCode: "CA",
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        externalPlaceId: `nominatim:${index}:${hit.lat},${hit.lon}`,
      };
    });
  }
}

export class GeocodingNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodingNotConfiguredError";
  }
}

export const geocodingService = new GeocodingService();
