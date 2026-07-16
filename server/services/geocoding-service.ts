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
import type { MapboxProximity } from "@/lib/geocoding/mapbox-search";
import {
  filterBusinessGeocodeResults,
  filterGeocodeResultsForLookupContext,
  pickPreferredGeocodeResult,
  rankBusinessGeocodeResults,
  rankGeocodeResults,
  resolveGeocodeAddressLine1,
} from "@/lib/geocoding/parse-result";
import {
  fetchGeocodingProvider,
  geocodingProviderClient,
} from "@/server/geocoding/provider-client";

export type GeocodeSource = "address" | "postal";

const MAX_RESULTS_PER_TIER = 5;
const MAX_BUSINESS_RESULTS = 10;
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
        const mapboxResults = await geocodingProviderClient.searchMapbox(query, token);
        if (mapboxResults.length > 0) return mapboxResults;
      } catch {
        // Fall through to Nominatim.
      }
    }

    try {
      return await geocodingProviderClient.searchNominatim(query);
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
        const rawSearchBox = await geocodingProviderClient.searchMapboxSearchBox(
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
          const results = await geocodingProviderClient.searchMapboxWithTypes(
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
        await geocodingProviderClient.searchNominatim(query, cityCentroid),
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
      const results = rankGeocodeResults(await geocodingProviderClient.searchNominatim(cityQuery));
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
      const results = await geocodingProviderClient.searchMapboxWithTypes(
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

      const response = await fetchGeocodingProvider("mapbox", "nearby-address", url);
      if (!response.ok) return [];

      const data = await response.json();
      return filterGeocodeResultsForLookupContext(
        rankGeocodeResults(
          (data.features ?? [])
            .map((feature: Parameters<typeof geocodingProviderClient.mapMapboxFeature>[0]) =>
              geocodingProviderClient.mapMapboxFeature(feature),
            )
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
        const results = await geocodingProviderClient.reverseGeocodeMapbox(latitude, longitude, token);
        if (results.length > 0) return results;
      } catch {
        // Fall through to Nominatim.
      }
    }

    try {
      return await geocodingProviderClient.reverseGeocodeNominatim(latitude, longitude);
    } catch {
      return [];
    }
  }

}

export class GeocodingNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodingNotConfiguredError";
  }
}

export const geocodingService = new GeocodingService();
