import { GEOCODING_PROVIDER_POLICY } from "@/config/constants";
import { cityFromMapboxPlaceName, streetFromMapboxPlaceName } from "@/lib/geocoding/mapbox-feature";
import { buildMapboxForwardGeocodeUrl, type MapboxProximity } from "@/lib/geocoding/mapbox-search";
import { buildMapboxSearchBoxForwardUrl, mapMapboxSearchBoxFeature } from "@/lib/geocoding/mapbox-searchbox";
import { isPostalCodeLabel, rankGeocodeResults } from "@/lib/geocoding/parse-result";
import { looksLikeStreetAddress } from "@/lib/geocoding/address-query";
import { recordMetric } from "@/lib/monitoring/sentry";
import type { GeocodingResult } from "@/types/domain";

const NOMINATIM_BUSINESS_VIEWBOX_DELTA = 0.25;

type GeocodeProvider = "mapbox" | "nominatim";

type MapboxFeature = {
  id: string;
  text: string;
  address?: string;
  place_name: string;
  place_type?: string[];
  center: [number, number];
  context?: Array<{ id: string; text: string; short_code?: string }>;
};

export async function fetchGeocodingProvider(
  provider: GeocodeProvider,
  operation: string,
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const retries = provider === "mapbox"
    ? GEOCODING_PROVIDER_POLICY.mapboxRetries
    : GEOCODING_PROVIDER_POLICY.nominatimRetries;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const startedAt = performance.now();
    try {
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(GEOCODING_PROVIDER_POLICY.timeoutMs),
      });
      recordMetric("geocoding.provider.duration_ms", performance.now() - startedAt, {
        provider, operation, status: response.status, attempt,
      });
      if (!response.ok) {
        recordMetric("geocoding.provider.failure", 1, {
          provider, operation, reason: "http", status: response.status, attempt,
        });
      }
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`${provider} ${operation} failed: ${response.status}`);
    } catch (error) {
      lastError = error;
      recordMetric("geocoding.provider.failure", 1, {
        provider,
        operation,
        reason: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network",
        attempt,
      });
    }
  }
  throw lastError ?? new Error(`${provider} ${operation} failed`);
}

export class GeocodingProviderClient {
  async searchMapbox(query: string, token: string): Promise<GeocodingResult[]> {
    return this.searchMapboxWithTypes(
      query,
      token,
      this.queryTargetsPostcode(query) ? "address,postcode,place" : "address,poi,postcode",
    );
  }

  async searchMapboxWithTypes(
    query: string,
    token: string,
    types: string,
    proximity?: MapboxProximity,
  ): Promise<GeocodingResult[]> {
    const response = await fetchGeocodingProvider(
      "mapbox",
      "forward",
      buildMapboxForwardGeocodeUrl(query, { accessToken: token, types, proximity }),
    );
    if (!response.ok) throw new Error(`Geocoding request failed: ${response.status}`);
    const data = await response.json();
    return (data.features ?? []).map((feature: MapboxFeature) => this.mapMapboxFeature(feature));
  }

  async searchMapboxSearchBox(
    query: string,
    token: string,
    proximity?: MapboxProximity,
    fallbackProvince?: string,
  ): Promise<GeocodingResult[]> {
    const response = await fetchGeocodingProvider(
      "mapbox",
      "search-box",
      buildMapboxSearchBoxForwardUrl(query, { accessToken: token, types: "poi", proximity }),
    );
    if (!response.ok) throw new Error(`Search Box request failed: ${response.status}`);
    const data = await response.json();
    return (data.features ?? []).map(
      (feature: Parameters<typeof mapMapboxSearchBoxFeature>[0]) =>
        mapMapboxSearchBoxFeature(feature, { fallbackProvince }),
    );
  }

  async searchNominatim(
    query: string,
    cityCentroid?: { latitude: number; longitude: number },
  ): Promise<GeocodingResult[]> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "10");
    url.searchParams.set("countrycodes", "ca");
    url.searchParams.set("addressdetails", "1");
    if (cityCentroid) {
      const { latitude, longitude } = cityCentroid;
      const delta = NOMINATIM_BUSINESS_VIEWBOX_DELTA;
      url.searchParams.set("viewbox", [longitude - delta, latitude + delta, longitude + delta, latitude - delta].join(","));
      url.searchParams.set("bounded", "1");
    }
    const response = await fetchGeocodingProvider("nominatim", "forward", url, {
      headers: { "User-Agent": "CobaltMerchantMap/1.0 (merchant submit geocoding)" },
    });
    if (!response.ok) throw new Error(`Geocoding request failed: ${response.status}`);
    return this.mapNominatimResults(await response.json());
  }

  async reverseGeocodeMapbox(
    latitude: number,
    longitude: number,
    token: string,
  ): Promise<GeocodingResult[]> {
    const strict = this.mapMapboxStreetResults(
      await this.fetchMapboxReverseFeatures(latitude, longitude, token, "address"),
    );
    if (strict.length > 0) return strict;
    return this.mapMapboxStreetResults(
      await this.fetchMapboxReverseFeatures(latitude, longitude, token, "address,street"),
    );
  }

  async reverseGeocodeNominatim(latitude: number, longitude: number): Promise<GeocodingResult[]> {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    const response = await fetchGeocodingProvider("nominatim", "reverse", url, {
      headers: { "User-Agent": "CobaltMerchantMap/1.0 (merchant submit geocoding)" },
    });
    if (!response.ok) throw new Error(`Reverse geocoding request failed: ${response.status}`);
    const hit = await response.json();
    const [result] = this.mapNominatimResults([hit]);
    const street = result?.addressLine1;
    return street && looksLikeStreetAddress(street)
      ? [{ ...result, externalPlaceId: `nominatim:reverse:${hit.lat},${hit.lon}` }]
      : [];
  }

  mapMapboxFeature(feature: MapboxFeature): GeocodingResult {
    const context = feature.context ?? [];
    const placeTypes = feature.place_type ?? [];
    const city = context.find((item) => item.id.startsWith("place."))?.text
      ?? cityFromMapboxPlaceName(feature.place_name)
      ?? "";
    const province = context.find((item) => item.id.startsWith("region."))?.short_code?.replace("CA-", "") ?? "";
    const postalFromContext = context.find((item) => item.id.startsWith("postcode."))?.text ?? "";
    let addressLine1 = "";
    if (placeTypes.includes("poi") && feature.place_name) {
      addressLine1 = streetFromMapboxPlaceName(feature.place_name);
    } else if (feature.address && feature.text && !isPostalCodeLabel(feature.text)
      && (placeTypes.includes("address") || looksLikeStreetAddress(feature.text))) {
      addressLine1 = `${feature.address} ${feature.text}`.trim();
    } else if (placeTypes.includes("address") && feature.text && !isPostalCodeLabel(feature.text)) {
      addressLine1 = feature.place_name.split(",")[0]?.trim() ?? feature.text;
    }
    return {
      name: feature.text,
      addressLine1,
      city,
      province,
      postalCode: postalFromContext || (isPostalCodeLabel(feature.text) ? feature.text : ""),
      countryCode: "CA",
      latitude: feature.center[1],
      longitude: feature.center[0],
      externalPlaceId: feature.id,
    };
  }

  private async fetchMapboxReverseFeatures(
    latitude: number,
    longitude: number,
    token: string,
    types: string,
  ): Promise<MapboxFeature[]> {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("types", types);
    url.searchParams.set("limit", "10");
    const response = await fetchGeocodingProvider("mapbox", "reverse", url);
    if (!response.ok) throw new Error(`Reverse geocoding request failed: ${response.status}`);
    const data = await response.json();
    return (data.features ?? []) as MapboxFeature[];
  }

  private mapMapboxStreetResults(features: MapboxFeature[]): GeocodingResult[] {
    return rankGeocodeResults(
      features.map((feature) => this.mapMapboxFeature(feature)).filter((result) =>
        Boolean(result.addressLine1 && looksLikeStreetAddress(result.addressLine1))),
    );
  }

  private queryTargetsPostcode(query: string): boolean {
    return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d/i.test(query.trim());
  }

  private mapNominatimResults(results: Array<Record<string, unknown>>): GeocodingResult[] {
    return results.map((raw, index) => {
      const hit = raw as {
        lat: string; lon: string; display_name: string;
        address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string; state?: string; postcode?: string };
      };
      const address = hit.address ?? {};
      const street = [address.house_number, address.road].filter(Boolean).join(" ");
      const city = address.city ?? address.town ?? address.village ?? "";
      const businessName = hit.display_name.split(",")[0]?.trim() ?? "";
      const fallbackLine = businessName;
      let addressLine1 = street || (fallbackLine && !isPostalCodeLabel(fallbackLine) ? fallbackLine : "");
      if (!addressLine1 || addressLine1 === businessName) {
        const streetPart = hit.display_name.split(",").map((part) => part.trim()).find(
          (part) => part && part !== businessName && looksLikeStreetAddress(part, { name: businessName }),
        );
        if (streetPart) addressLine1 = streetPart;
      }
      return {
        name: businessName || street || fallbackLine || "Location",
        addressLine1,
        city,
        province: address.state ?? "",
        postalCode: address.postcode ?? "",
        countryCode: "CA",
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        externalPlaceId: `nominatim:${index}:${hit.lat},${hit.lon}`,
        geocodeLabel: hit.display_name,
      };
    });
  }
}

export const geocodingProviderClient = new GeocodingProviderClient();
