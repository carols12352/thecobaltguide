import type { GeocodingResult } from "@/types/domain";
import {
  buildAddressGeocodeQueries,
  buildBusinessPoiSearchQueries,
  buildCityCentroidQuery,
  buildGeocodeQueriesForTier,
  buildPostalStreetSearchQuery,
  dedupeGeocodeResults,
  looksLikeStreetAddress,
  mergeGeocodeResultsByTier,
  type GeocodeMatchTier,
} from "@/lib/geocoding/address-query";
import {
  buildMapboxForwardGeocodeUrl,
  type MapboxProximity,
} from "@/lib/geocoding/mapbox-search";
import {
  buildMapboxSearchBoxForwardUrl,
  mapMapboxSearchBoxFeature,
} from "@/lib/geocoding/mapbox-searchbox";
import { streetFromMapboxPlaceName, cityFromMapboxPlaceName } from "@/lib/geocoding/mapbox-feature";
import {
  filterBusinessGeocodeResults,
  filterGeocodeResultsForLookupContext,
  isPostalCodeLabel,
  pickPreferredGeocodeResult,
  rankBusinessGeocodeResults,
  rankGeocodeResults,
  resolveGeocodeAddressLine1,
} from "@/lib/geocoding/parse-result";

export type GeocodeSource = "address" | "postal";

const MAX_RESULTS_PER_TIER = 5;
const MAX_BUSINESS_RESULTS = 10;
const NOMINATIM_BUSINESS_VIEWBOX_DELTA = 0.25;

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
    const streetContext = { city: input.city, name: input.name };
    const streetAddress = looksLikeStreetAddress(
      input.addressLine1 ?? "",
      streetContext,
    )
      ? input.addressLine1
      : undefined;
    const addressInput = { ...input, addressLine1: streetAddress };

    const tierResults: Record<GeocodeMatchTier, GeocodingResult[]> = {
      postal: [],
      address: [],
      name: [],
    };

    if (input.postalCode?.trim()) {
      tierResults.postal = await this.collectTierResults(
        "postal",
        input,
        addressInput,
      );
    }

    if (streetAddress) {
      tierResults.address = await this.collectTierResults(
        "address",
        input,
        addressInput,
      );
    }

    if (input.name?.trim()) {
      tierResults.name = await this.collectBusinessTierResults(input);
    }

    const merged = mergeGeocodeResultsByTier(tierResults, {
      maxPerTier: MAX_BUSINESS_RESULTS,
      maxTotal: MAX_BUSINESS_RESULTS,
    });

    if (merged.length === 0) {
      return { results: [], source: null };
    }

    const preferred = pickPreferredGeocodeResult(merged, addressInput);
    const ordered =
      preferred && preferred !== merged[0]
        ? [preferred, ...merged.filter((result) => result !== preferred)]
        : merged;

    return {
      results: ordered,
      source: ordered[0]!.matchTier === "postal" ? "postal" : "address",
    };
  }

  private async collectBusinessTierResults(
    input: StructuredGeocodeInput,
  ): Promise<GeocodingResult[]> {
    const queries = buildBusinessPoiSearchQueries(input);
    if (queries.length === 0) return [];

    const token = process.env.MAPBOX_ACCESS_TOKEN;
    const cityCentroid = await this.resolveCityCentroid(input, token);
    const proximity = cityCentroid
      ? {
          longitude: cityCentroid.longitude,
          latitude: cityCentroid.latitude,
        }
      : undefined;

    const rawSets = await Promise.all(
      queries.map(async (query) =>
        this.searchBusinessQuery(input, query, token, proximity, cityCentroid),
      ),
    );

    let searchBoxResults: GeocodingResult[] = [];
    if (token && input.name?.trim()) {
      try {
        const rawSearchBox = await this.searchMapboxSearchBox(
          input.name.trim(),
          token,
          proximity,
          input.province,
        );
        searchBoxResults = this.filterBusinessTierResults(
          rawSearchBox,
          input,
          cityCentroid,
        );
      } catch {
        // Search Box is supplementary; fall back to geocoding + Nominatim.
      }
    }

    let combined: GeocodingResult[] = dedupeGeocodeResults([
      ...rawSets.flat(),
      ...searchBoxResults,
    ]).map((result) => ({
      ...result,
      matchTier: "name" as const,
    }));
    combined = rankBusinessGeocodeResults(combined, input);
    return combined.slice(0, MAX_BUSINESS_RESULTS);
  }

  private async searchBusinessQuery(
    input: StructuredGeocodeInput,
    query: string,
    token: string | undefined,
    proximity: MapboxProximity | undefined,
    cityCentroid?: { latitude: number; longitude: number },
  ): Promise<GeocodingResult[]> {
    if (token) {
      try {
        for (const types of ["poi", "poi,address"] as const) {
          const results = await this.searchMapboxWithTypes(
            query,
            token,
            types,
            proximity,
          );
          const filtered = this.filterBusinessTierResults(
            results,
            input,
            cityCentroid,
          );
          if (filtered.length > 0) return filtered;
        }
      } catch {
        // Fall through to Nominatim.
      }
    }

    try {
      const results = rankGeocodeResults(
        await this.searchNominatim(query, cityCentroid),
      );
      return this.filterBusinessTierResults(results, input, cityCentroid);
    } catch {
      return [];
    }
  }

  private filterBusinessTierResults(
    results: GeocodingResult[],
    input: StructuredGeocodeInput,
    cityCentroid?: { latitude: number; longitude: number },
  ): GeocodingResult[] {
    let filtered = filterBusinessGeocodeResults(results, input);
    filtered = filterGeocodeResultsForLookupContext(filtered, input, {
      tier: "name",
      cityCentroid,
    });
    return filtered;
  }

  private async resolveCityCentroid(
    input: StructuredGeocodeInput,
    token: string | undefined,
  ): Promise<{ latitude: number; longitude: number } | undefined> {
    if (token) {
      const proximity = await this.resolveCityProximity(input, token);
      if (proximity) {
        return {
          latitude: proximity.latitude,
          longitude: proximity.longitude,
        };
      }
    }

    const cityQuery = buildCityCentroidQuery(input);
    if (!cityQuery) return undefined;

    try {
      const results = rankGeocodeResults(await this.searchNominatim(cityQuery));
      const anchor = results[0];
      if (!anchor) return undefined;
      return { latitude: anchor.latitude, longitude: anchor.longitude };
    } catch {
      return undefined;
    }
  }

  private async resolveCityProximity(
    input: StructuredGeocodeInput,
    token: string,
  ): Promise<MapboxProximity | undefined> {
    const cityQuery = buildCityCentroidQuery(input);
    if (!cityQuery) return undefined;

    try {
      const results = await this.searchMapboxWithTypes(
        cityQuery,
        token,
        "place,locality",
      );
      const anchor =
        results.find(
          (result) =>
            input.province?.trim() &&
            result.province.toUpperCase() === input.province.trim().toUpperCase(),
        ) ?? results[0];
      if (!anchor) return undefined;

      return {
        longitude: anchor.longitude,
        latitude: anchor.latitude,
      };
    } catch {
      return undefined;
    }
  }

  private async collectTierResults(
    tier: GeocodeMatchTier,
    input: StructuredGeocodeInput,
    addressInput: StructuredGeocodeInput,
  ): Promise<GeocodingResult[]> {
    const queries =
      tier === "address"
        ? buildAddressGeocodeQueries(addressInput)
        : buildGeocodeQueriesForTier(tier, input);
    if (queries.length === 0) return [];

    const rankOptions = input.postalCode
      ? { targetPostalCode: input.postalCode }
      : undefined;

    const queryResultSets = await Promise.all(
      queries.map(async (query) => {
        let results = rankGeocodeResults(
          await this.searchAddress(query),
          rankOptions,
        );
        results = filterGeocodeResultsForLookupContext(results, input, { tier });
        return results;
      }),
    );

    let combined: GeocodingResult[] = dedupeGeocodeResults(queryResultSets.flat()).map(
      (result) => ({ ...result, matchTier: tier }),
    );

    if (combined.length === 0) return [];

    if (tier === "postal") {
      combined = await this.enrichPostalResults(combined, input);
    } else if (tier === "address") {
      combined = await this.ensureStreetAddressResults(combined, input);
    }

    return combined
      .map((result) => ({ ...result, matchTier: tier }))
      .slice(0, MAX_RESULTS_PER_TIER);
  }

  private async ensureStreetAddressResults(
    results: GeocodingResult[],
    input: StructuredGeocodeInput,
  ): Promise<GeocodingResult[]> {
    const streetContext = { city: input.city, name: input.name };
    if (results.length === 0 || this.hasStreetAddress(results, streetContext)) {
      return results;
    }

    const anchor = results[0]!;
    const rankOptions = input.postalCode
      ? { targetPostalCode: input.postalCode }
      : undefined;

    let streets = this.filterStreetResults(
      rankGeocodeResults(
        await this.reverseGeocode(anchor.latitude, anchor.longitude),
        rankOptions,
      ),
      streetContext,
    );

    streets = filterGeocodeResultsForLookupContext(streets, input, {
      tier: "address",
    });

    if (streets.length === 0) {
      streets = this.filterStreetResults(
        rankGeocodeResults(
          await this.searchStreetAddressesNear(
            anchor.latitude,
            anchor.longitude,
            input,
          ),
          rankOptions,
        ),
        streetContext,
      );
      streets = filterGeocodeResultsForLookupContext(streets, input, {
        tier: "address",
      });
    }

    if (streets.length > 0) {
      return streets.map((streetResult) => ({
        ...streetResult,
        latitude: anchor.latitude,
        longitude: anchor.longitude,
        name: anchor.name || streetResult.name,
      }));
    }

    const reversed = rankGeocodeResults(
      await this.reverseGeocode(anchor.latitude, anchor.longitude),
      rankOptions,
    );
    const reverse = reversed[0];
    if (!reverse) return results;

    const street = resolveGeocodeAddressLine1(reverse);
    return rankGeocodeResults(
      [
        {
          ...anchor,
          addressLine1: street ?? reverse.addressLine1 ?? anchor.addressLine1,
          city: reverse.city || anchor.city,
          province: reverse.province || anchor.province,
          postalCode: reverse.postalCode || anchor.postalCode,
        },
      ],
      rankOptions,
    );
  }

  private filterStreetResults(
    results: GeocodingResult[],
    context: { city?: string; name?: string } = {},
  ): GeocodingResult[] {
    return results.filter((result) => {
      const street = resolveGeocodeAddressLine1(result);
      return Boolean(street && looksLikeStreetAddress(street, context));
    });
  }

  async reverseGeocodeAt(
    latitude: number,
    longitude: number,
  ): Promise<GeocodingResult[]> {
    return this.reverseGeocode(latitude, longitude);
  }

  private hasStreetAddress(
    results: GeocodingResult[],
    context: { city?: string; name?: string } = {},
  ): boolean {
    return results.some((result) => {
      const street = resolveGeocodeAddressLine1(result);
      return Boolean(street && looksLikeStreetAddress(street, context));
    });
  }

  private async enrichPostalResults(
    centroidResults: GeocodingResult[],
    input: StructuredGeocodeInput,
  ): Promise<GeocodingResult[]> {
    const anchor = centroidResults[0];
    if (!anchor) return centroidResults;

    const streetContext = { city: input.city, name: input.name };
    const targetPostal = input.postalCode?.trim();
    const rankOptions = targetPostal
      ? { targetPostalCode: targetPostal }
      : undefined;
    const streetResults: GeocodingResult[] = [];

    if (input.name?.trim()) {
      streetResults.push(
        ...filterGeocodeResultsForLookupContext(
          rankGeocodeResults(
            await this.searchAddress(
              [input.name.trim(), input.postalCode, input.city, input.province, "Canada"]
                .filter(Boolean)
                .join(", "),
            ),
            rankOptions,
          ),
          input,
          { tier: "postal" },
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

    if (!this.hasStreetAddress(streetResults, streetContext)) {
      streetResults.push(
        ...(await this.reverseGeocode(anchor.latitude, anchor.longitude)),
      );
    }

    let streets = rankGeocodeResults(streetResults, rankOptions).filter(
      (result) => {
        const street = resolveGeocodeAddressLine1(result);
        return Boolean(
          street && looksLikeStreetAddress(street, streetContext),
        );
      },
    );

    streets = filterGeocodeResultsForLookupContext(streets, input, {
      tier: "postal",
    });

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

    const streetContext = { city: input.city, name: input.name };

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
      return filterGeocodeResultsForLookupContext(
        rankGeocodeResults(
          (data.features ?? [])
            .map((feature: MapboxFeature) => this.mapMapboxFeature(feature))
            .filter((result: GeocodingResult) => {
              const street = resolveGeocodeAddressLine1(result);
              return Boolean(
                street && looksLikeStreetAddress(street, streetContext),
              );
            }),
          input.postalCode ? { targetPostalCode: input.postalCode } : undefined,
        ),
        input,
        { tier: "postal" },
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
    const strict = await this.fetchMapboxReverseFeatures(
      latitude,
      longitude,
      token,
      "address",
    );
    const strictResults = this.mapMapboxStreetResults(strict);
    if (strictResults.length > 0) return strictResults;

    const broad = await this.fetchMapboxReverseFeatures(
      latitude,
      longitude,
      token,
      "address,street",
    );
    return this.mapMapboxStreetResults(broad);
  }

  private async fetchMapboxReverseFeatures(
    latitude: number,
    longitude: number,
    token: string,
    types: string,
  ): Promise<MapboxFeature[]> {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("types", types);
    url.searchParams.set("limit", "10");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Reverse geocoding request failed: ${response.status}`);
    }

    const data = await response.json();
    return (data.features ?? []) as MapboxFeature[];
  }

  private mapMapboxStreetResults(features: MapboxFeature[]): GeocodingResult[] {
    return rankGeocodeResults(
      features
        .map((feature) => this.mapMapboxFeature(feature))
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
    const city =
      ctx.find((c) => c.id.startsWith("place."))?.text ??
      cityFromMapboxPlaceName(feature.place_name) ??
      "";
    const province =
      ctx.find((c) => c.id.startsWith("region."))?.short_code?.replace("CA-", "") ??
      "";
    const postalFromContext =
      ctx.find((c) => c.id.startsWith("postcode."))?.text ?? "";

    let addressLine1 = "";
    if (placeTypes.includes("poi") && feature.place_name) {
      addressLine1 = streetFromMapboxPlaceName(feature.place_name);
    } else if (
      feature.address &&
      feature.text &&
      !isPostalCodeLabel(feature.text) &&
      (placeTypes.includes("address") || looksLikeStreetAddress(feature.text))
    ) {
      addressLine1 = `${feature.address} ${feature.text}`.trim();
    } else if (
      placeTypes.includes("address") &&
      feature.text &&
      !isPostalCodeLabel(feature.text)
    ) {
      addressLine1 = feature.place_name.split(",")[0]?.trim() ?? feature.text;
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

  private async searchMapboxSearchBox(
    query: string,
    token: string,
    proximity?: MapboxProximity,
    fallbackProvince?: string,
  ): Promise<GeocodingResult[]> {
    const url = buildMapboxSearchBoxForwardUrl(query, {
      accessToken: token,
      types: "poi",
      proximity,
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Search Box request failed: ${response.status}`);
    }

    const data = await response.json();
    return (data.features ?? []).map((feature: Parameters<typeof mapMapboxSearchBoxFeature>[0]) =>
      mapMapboxSearchBoxFeature(feature, { fallbackProvince }),
    );
  }

  private async searchMapbox(
    query: string,
    token: string,
  ): Promise<GeocodingResult[]> {
    return this.searchMapboxWithTypes(
      query,
      token,
      this.queryTargetsPostcode(query)
        ? "address,postcode,place"
        : "address,poi,postcode",
    );
  }

  private async searchMapboxWithTypes(
    query: string,
    token: string,
    types: string,
    proximity?: MapboxProximity,
  ): Promise<GeocodingResult[]> {
    const url = buildMapboxForwardGeocodeUrl(query, {
      accessToken: token,
      types,
      proximity,
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status}`);
    }

    const data = await response.json();
    return (data.features ?? []).map((feature: MapboxFeature) =>
      this.mapMapboxFeature(feature),
    );
  }

  private async searchNominatim(
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
      url.searchParams.set(
        "viewbox",
        [
          longitude - delta,
          latitude + delta,
          longitude + delta,
          latitude - delta,
        ].join(","),
      );
      url.searchParams.set("bounded", "1");
    }

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
      const businessName = hit.display_name.split(",")[0]?.trim() ?? "";
      const fallbackLine = hit.display_name.split(",")[0]?.trim() ?? "";
      let addressLine1 =
        street ||
        (fallbackLine && !isPostalCodeLabel(fallbackLine) ? fallbackLine : "");
      if (!addressLine1 || addressLine1 === businessName) {
        const streetPart = hit.display_name
          .split(",")
          .map((part) => part.trim())
          .find(
            (part) =>
              part &&
              part !== businessName &&
              looksLikeStreetAddress(part, { name: businessName }),
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

export class GeocodingNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodingNotConfiguredError";
  }
}

export const geocodingService = new GeocodingService();
