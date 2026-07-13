import type { GeocodingResult } from "@/types/domain";
import {
  buildAddressGeocodeQueries,
  buildPostalGeocodeQueries,
  buildPostalStreetSearchQuery,
  looksLikeStreetAddress,
} from "@/lib/geocoding/address-query";
import {
  filterGeocodeResultsForPostalCode,
  isPostalCodeLabel,
  rankGeocodeResults,
  resolveGeocodeAddressLine1,
} from "@/lib/geocoding/parse-result";

export type GeocodeSource = "address" | "postal";

type MapboxFeature = {
  id: string;
  text: string;
  address?: string;
  place_name: string;
  place_type?: string[];
  center: [number, number];
  context?: Array<{ id: string; text: string; short_code?: string }>;
};

type StructuredGeocodeInput = {
  name?: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode?: string;
};

export class GeocodingService {
  async searchAddress(query: string): Promise<GeocodingResult[]> {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (token) {
      try {
        const mapboxResults = await this.searchMapbox(query, token);
        if (mapboxResults.length > 0) return mapboxResults;
      } catch {
        // Fall through to Nominatim.
      }
    }

    try {
      return await this.searchNominatim(query);
    } catch {
      return [];
    }
  }

  async geocodeStructuredAddress(
    input: StructuredGeocodeInput,
  ): Promise<{ results: GeocodingResult[]; source: GeocodeSource | null }> {
    const streetAddress = looksLikeStreetAddress(input.addressLine1 ?? "")
      ? input.addressLine1
      : undefined;

    const addressInput = { ...input, addressLine1: streetAddress };
    for (const query of buildAddressGeocodeQueries(addressInput)) {
      const rankOptions = input.postalCode
        ? { targetPostalCode: input.postalCode }
        : undefined;
      let results = rankGeocodeResults(
        await this.searchAddress(query),
        rankOptions,
      );
      if (input.postalCode) {
        const filtered = filterGeocodeResultsForPostalCode(
          results,
          input.postalCode,
        );
        if (filtered.length > 0) results = filtered;
      }
      if (results.length > 0) {
        return { results, source: "address" };
      }
    }

    if (input.postalCode) {
      for (const query of buildPostalGeocodeQueries(input)) {
        const centroidResults = rankGeocodeResults(await this.searchAddress(query));
        if (centroidResults.length > 0) {
          const results = await this.enrichPostalResults(centroidResults, input);
          return { results, source: "postal" };
        }
      }
    }

    return { results: [], source: null };
  }

  async reverseGeocodeAt(
    latitude: number,
    longitude: number,
  ): Promise<GeocodingResult[]> {
    return this.reverseGeocode(latitude, longitude);
  }

  private hasStreetAddress(results: GeocodingResult[]): boolean {
    return results.some((result) => {
      const street = resolveGeocodeAddressLine1(result);
      return Boolean(street && looksLikeStreetAddress(street));
    });
  }

  private async enrichPostalResults(
    centroidResults: GeocodingResult[],
    input: StructuredGeocodeInput,
  ): Promise<GeocodingResult[]> {
    const anchor = centroidResults[0];
    if (!anchor) return centroidResults;

    const targetPostal = input.postalCode?.trim();
    const rankOptions = targetPostal
      ? { targetPostalCode: targetPostal }
      : undefined;
    const streetResults: GeocodingResult[] = [];

    if (input.name?.trim()) {
      streetResults.push(
        ...rankGeocodeResults(
          await this.searchAddress(
            [input.name.trim(), input.postalCode, input.city, input.province, "Canada"]
              .filter(Boolean)
              .join(", "),
          ),
          rankOptions,
        ),
      );
    }

    streetResults.push(
      ...(await this.searchStreetAddressesNear(
        anchor.latitude,
        anchor.longitude,
        input,
      )),
    );

    if (!this.hasStreetAddress(streetResults)) {
      streetResults.push(
        ...(await this.reverseGeocode(anchor.latitude, anchor.longitude)),
      );
    }

    let streets = rankGeocodeResults(streetResults, rankOptions).filter(
      (result) => {
        const street = resolveGeocodeAddressLine1(result);
        return Boolean(street && looksLikeStreetAddress(street));
      },
    );

    if (targetPostal) {
      streets = filterGeocodeResultsForPostalCode(streets, targetPostal);
    }

    if (streets.length > 0) return streets;

    return rankGeocodeResults(centroidResults, rankOptions);
  }

  private async searchStreetAddressesNear(
    latitude: number,
    longitude: number,
    input: StructuredGeocodeInput,
  ): Promise<GeocodingResult[]> {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    const query = buildPostalStreetSearchQuery(input);
    if (!token || !query) return [];

    try {
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
      );
      url.searchParams.set("access_token", token);
      url.searchParams.set("country", "ca");
      url.searchParams.set("types", "address");
      url.searchParams.set("proximity", `${longitude},${latitude}`);
      url.searchParams.set("limit", "10");

      const response = await fetch(url.toString());
      if (!response.ok) return [];

      const data = await response.json();
      return rankGeocodeResults(
        (data.features ?? [])
          .map((feature: MapboxFeature) => this.mapMapboxFeature(feature))
          .filter((result: GeocodingResult) => {
            const street = resolveGeocodeAddressLine1(result);
            return Boolean(street && looksLikeStreetAddress(street));
          }),
        input.postalCode ? { targetPostalCode: input.postalCode } : undefined,
      );
    } catch {
      return [];
    }
  }

  private async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<GeocodingResult[]> {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (token) {
      try {
        const results = await this.reverseGeocodeMapbox(latitude, longitude, token);
        if (results.length > 0) return results;
      } catch {
        // Fall through to Nominatim.
      }
    }

    try {
      return await this.reverseGeocodeNominatim(latitude, longitude);
    } catch {
      return [];
    }
  }

  private async reverseGeocodeMapbox(
    latitude: number,
    longitude: number,
    token: string,
  ): Promise<GeocodingResult[]> {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("types", "address");
    url.searchParams.set("limit", "5");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Reverse geocoding request failed: ${response.status}`);
    }

    const data = await response.json();
    return rankGeocodeResults(
      (data.features ?? [])
        .map((feature: MapboxFeature) => this.mapMapboxFeature(feature))
        .filter((result: GeocodingResult) => {
          const street = resolveGeocodeAddressLine1(result);
          return Boolean(street && looksLikeStreetAddress(street));
        }),
    );
  }

  private async reverseGeocodeNominatim(
    latitude: number,
    longitude: number,
  ): Promise<GeocodingResult[]> {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "CobaltMerchantMap/1.0 (merchant submit geocoding)",
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding request failed: ${response.status}`);
    }

    const hit = (await response.json()) as {
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
    };

    const address = hit.address ?? {};
    const street = [address.house_number, address.road].filter(Boolean).join(" ");
    if (!street) return [];

    const city = address.city ?? address.town ?? address.village ?? "";
    return rankGeocodeResults([
      {
        name: street,
        addressLine1: street,
        city,
        province: address.state ?? "",
        postalCode: address.postcode ?? "",
        countryCode: "CA",
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        externalPlaceId: `nominatim:reverse:${hit.lat},${hit.lon}`,
      },
    ]);
  }

  private queryTargetsPostcode(query: string): boolean {
    return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d/i.test(
      query.trim(),
    );
  }

  private mapMapboxFeature(feature: MapboxFeature): GeocodingResult {
    const ctx = feature.context ?? [];
    const placeTypes = feature.place_type ?? [];
    const city = ctx.find((c) => c.id.startsWith("place."))?.text ?? "";
    const province =
      ctx.find((c) => c.id.startsWith("region."))?.short_code?.replace("CA-", "") ??
      "";
    const postalFromContext =
      ctx.find((c) => c.id.startsWith("postcode."))?.text ?? "";

    let addressLine1 = "";
    if (feature.address && feature.text && !isPostalCodeLabel(feature.text)) {
      addressLine1 = `${feature.address} ${feature.text}`.trim();
    } else if (
      placeTypes.includes("address") &&
      feature.text &&
      !isPostalCodeLabel(feature.text)
    ) {
      addressLine1 = feature.place_name.split(",")[0]?.trim() ?? feature.text;
    } else if (
      placeTypes.includes("poi") &&
      feature.place_name &&
      !isPostalCodeLabel(feature.text)
    ) {
      const parts = feature.place_name.split(",").map((part) => part.trim());
      const streetPart = parts.find((part) => looksLikeStreetAddress(part));
      addressLine1 = streetPart ?? "";
    }

    const postalCode = postalFromContext
      || (isPostalCodeLabel(feature.text) ? feature.text : "");

    return {
      name: feature.text,
      addressLine1,
      city,
      province,
      postalCode,
      countryCode: "CA",
      latitude: feature.center[1],
      longitude: feature.center[0],
      externalPlaceId: feature.id,
    };
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
    url.searchParams.set(
      "types",
      this.queryTargetsPostcode(query)
        ? "address,postcode,place"
        : "address,poi,postcode",
    );
    url.searchParams.set("limit", "10");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status}`);
    }

    const data = await response.json();
    return (data.features ?? []).map((feature: MapboxFeature) =>
      this.mapMapboxFeature(feature),
    );
  }

  private async searchNominatim(query: string): Promise<GeocodingResult[]> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "10");
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
      const city = address.city ?? address.town ?? address.village ?? "";
      const fallbackLine = hit.display_name.split(",")[0]?.trim() ?? "";
      const addressLine1 =
        street ||
        (fallbackLine && !isPostalCodeLabel(fallbackLine) ? fallbackLine : "");

      return {
        name: street || fallbackLine || "Location",
        addressLine1,
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
