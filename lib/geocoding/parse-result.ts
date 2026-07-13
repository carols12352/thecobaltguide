import {
  isCityOrNameLine,
  looksLikeCityLabel,
  looksLikeCityNameStreetNoise,
  looksLikeStreetAddress,
} from "@/lib/geocoding/address-query";
import {
  isValidCanadianPostalCode,
  normalizeCanadianPostalCode,
} from "@/lib/validation/canadian-postal-code";
import type { GeocodingResult } from "@/types/domain";

/** Legacy export — name-tier lookups use strict city matching, not metro radius. */
export const BUSINESS_LOOKUP_METRO_RADIUS_METRES = 35_000;

function distanceMetres(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadius = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function filterGeocodeResultsNearPoint(
  results: GeocodingResult[],
  anchor: { latitude: number; longitude: number },
  radiusMetres: number,
): GeocodingResult[] {
  return results.filter(
    (result) =>
      distanceMetres(
        anchor.latitude,
        anchor.longitude,
        result.latitude,
        result.longitude,
      ) <= radiusMetres,
  );
}

export function normalizePostalForCompare(value: string): string {
  return normalizeCanadianPostalCode(value).replace(/\s+/g, "");
}

export function postalCodesEqual(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  return normalizePostalForCompare(a) === normalizePostalForCompare(b);
}

/** Keep only results whose postal code exactly matches the lookup input. */
export function filterGeocodeResultsForPostalCode(
  results: GeocodingResult[],
  targetPostalCode: string,
): GeocodingResult[] {
  const target = normalizeCanadianPostalCode(targetPostalCode);
  return results.filter(
    (result) => result.postalCode && postalCodesEqual(result.postalCode, target),
  );
}

function normalizeCityForCompare(value: string): string {
  return value.trim().toLocaleLowerCase("en-CA");
}

export function filterGeocodeResultsForCity(
  results: GeocodingResult[],
  targetCity: string,
): GeocodingResult[] {
  const target = normalizeCityForCompare(targetCity);
  return results.filter(
    (result) =>
      result.city?.trim() &&
      normalizeCityForCompare(result.city) === target,
  );
}

function municipalityAppearsInGeocodeLabel(
  label: string,
  targetCity: string,
): boolean {
  const target = normalizeCityForCompare(targetCity);
  if (!target) return false;

  return label
    .split(",")
    .map((part) => normalizeCityForCompare(part.trim()))
    .includes(target);
}

export function resultMatchesLookupCity(
  result: GeocodingResult,
  targetCity: string,
): boolean {
  const target = targetCity.trim();
  if (!target) return true;

  if (
    result.city?.trim() &&
    normalizeCityForCompare(result.city) === normalizeCityForCompare(target)
  ) {
    return true;
  }

  const label = [result.geocodeLabel, result.name, result.addressLine1]
    .filter(Boolean)
    .join(", ");

  return municipalityAppearsInGeocodeLabel(label, target);
}

type LookupFilterInput = {
  postalCode?: string;
  city?: string;
};

type LookupFilterOptions = {
  tier: "postal" | "address" | "name";
  cityCentroid?: { latitude: number; longitude: number };
  metroRadiusMetres?: number;
};

/** Drop out-of-area geocoder hits when the lookup specifies postal and/or city. */
export function filterGeocodeResultsForLookupContext(
  results: GeocodingResult[],
  input: LookupFilterInput,
  options: LookupFilterOptions,
): GeocodingResult[] {
  let filtered = results;
  const targetPostal = input.postalCode?.trim();
  const targetCity = input.city?.trim();

  if (targetPostal) {
    const byPostal = filterGeocodeResultsForPostalCode(filtered, targetPostal);
    if (byPostal.length > 0) {
      filtered = byPostal;
    } else if (options.tier === "name") {
      // POI/business lookup: postal is a hint, not a hard filter.
    } else if (options.tier !== "postal") {
      return [];
    }
  }

  if (targetCity && options.tier !== "postal") {
    const byCity = filterGeocodeResultsForCity(filtered, targetCity);
    const looseCity = filtered.filter((result) =>
      resultMatchesLookupCity(result, targetCity),
    );

    if (options.tier === "name") {
      const merged = new Map<string, GeocodingResult>();
      for (const result of [...byCity, ...looseCity]) {
        merged.set(
          result.externalPlaceId || `${result.latitude},${result.longitude}`,
          result,
        );
      }
      if (merged.size > 0) {
        filtered = Array.from(merged.values());
      } else {
        filtered = [];
      }
    } else if (byCity.length > 0) {
      filtered = byCity;
    } else if (targetPostal) {
      return [];
    }
  }

  return filtered;
}

export function isPoiGeocodeResult(result: GeocodingResult): boolean {
  return result.externalPlaceId.startsWith("poi.");
}

/** Keep POI/business hits; drop city-name street noise for merchant name + city lookups. */
export function filterBusinessGeocodeResults(
  results: GeocodingResult[],
  input: { name?: string; city?: string },
): GeocodingResult[] {
  const city = input.city?.trim();
  const businessName = input.name?.trim()?.toLocaleLowerCase("en-CA");

  return results.filter((result) => {
    if (isPoiGeocodeResult(result)) return true;

    const resultLabel = [result.name, result.addressLine1]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("en-CA");

    if (
      businessName &&
      !result.externalPlaceId.startsWith("nominatim:") &&
      !resultLabel.includes(businessName)
    ) {
      const tokens = businessName.split(/\s+/).filter((token) => token.length > 3);
      if (!tokens.some((token) => resultLabel.includes(token))) {
        return false;
      }
    }

    const street = resolveGeocodeAddressLine1(result);
    if (!street) {
      return Boolean(businessName && resultLabel.includes(businessName));
    }

    if (city && looksLikeCityNameStreetNoise(street, city)) {
      return false;
    }

    return true;
  });
}

export function rankBusinessGeocodeResults(
  results: GeocodingResult[],
  input: { name?: string; city?: string },
): GeocodingResult[] {
  const businessName = input.name?.trim()?.toLocaleLowerCase("en-CA") ?? "";
  const targetCity = input.city?.trim()?.toLocaleLowerCase("en-CA") ?? "";

  return [...results].sort((a, b) => scoreBusinessResult(b) - scoreBusinessResult(a));

  function scoreBusinessResult(result: GeocodingResult): number {
    let score = 0;
    const resultName = result.name.trim().toLocaleLowerCase("en-CA");
    const resultCity = result.city?.trim()?.toLocaleLowerCase("en-CA") ?? "";

    if (isPoiGeocodeResult(result)) score += 20;
    if (businessName && resultName.includes(businessName)) score += 15;
    if (businessName && resultName === businessName) score += 10;
    if (targetCity && resultCity === targetCity) score += 10;

    const street = resolveGeocodeAddressLine1(result);
    if (street && input.city && looksLikeCityNameStreetNoise(street, input.city)) {
      score -= 25;
    }

    return score;
  }
}

export function formatGeocodeResultLabel(result: GeocodingResult): string {
  const street = resolveGeocodeAddressLine1(result);
  if (street) {
    return [street, result.city, result.province, result.postalCode]
      .filter(Boolean)
      .join(", ");
  }

  const parts = [result.name, result.city, result.province, result.postalCode].filter(
    Boolean,
  );
  if (parts.length > 0) return parts.join(", ");

  return `${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`;
}

export function pickPreferredGeocodeResult(
  results: GeocodingResult[],
  input: { name?: string; city?: string; addressLine1?: string },
): GeocodingResult | undefined {
  if (results.length === 0) return undefined;

  const hasStreetLookup = Boolean(
    input.addressLine1?.trim() &&
      looksLikeStreetAddress(input.addressLine1.trim(), {
        city: input.city,
        name: input.name,
      }),
  );

  if (input.name?.trim() && input.city?.trim() && !hasStreetLookup) {
    const ranked = rankBusinessGeocodeResults(results, input);
    const poiInCity = ranked.find(
      (result) =>
        isPoiGeocodeResult(result) &&
        result.city?.trim() &&
        normalizeCityForCompare(result.city) ===
          normalizeCityForCompare(input.city!),
    );
    if (poiInCity) return poiInCity;

    const businessMatch = ranked.find((result) => {
      const name = result.name.trim().toLocaleLowerCase("en-CA");
      const query = input.name!.trim().toLocaleLowerCase("en-CA");
      return name.includes(query) && !resolveGeocodeAddressLine1(result);
    });
    if (businessMatch) return businessMatch;
  }

  return results[0];
}

function resolveLookupPostalCode(current: string, fromResult: string): string {
  const currentNorm = current.trim() ? normalizeCanadianPostalCode(current) : "";
  const resultNorm = fromResult.trim() ? normalizeCanadianPostalCode(fromResult) : "";

  if (currentNorm && resultNorm && !postalCodesEqual(currentNorm, resultNorm)) {
    return currentNorm;
  }

  return resultNorm || currentNorm;
}

export function isPostalCodeLabel(value: string | undefined | null): boolean {
  if (!value?.trim()) return false;
  return isValidCanadianPostalCode(value.trim());
}

/** Street or place label suitable for address line 1 — never a postal code or city label. */
export function resolveGeocodeAddressLine1(
  result: GeocodingResult,
): string | undefined {
  const context = { city: result.city };
  const candidates = [result.addressLine1, result.name].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed || isPostalCodeLabel(trimmed)) continue;
    if (isCityOrNameLine(trimmed, context)) continue;
    if (looksLikeCityLabel(trimmed, context)) continue;
    if (looksLikeStreetAddress(trimmed, context)) return trimmed;
  }

  return undefined;
}

export function normalizeGeocodeResult(result: GeocodingResult): GeocodingResult {
  const addressLine1 = resolveGeocodeAddressLine1(result) ?? "";
  const postalCode = result.postalCode?.trim()
    ? normalizeCanadianPostalCode(result.postalCode)
    : "";

  return {
    ...result,
    addressLine1,
    postalCode,
  };
}

export function rankGeocodeResults(
  results: GeocodingResult[],
  options?: { targetPostalCode?: string },
): GeocodingResult[] {
  const targetPostalCode = options?.targetPostalCode;
  return [...results]
    .map(normalizeGeocodeResult)
    .sort(
      (a, b) =>
        geocodeResultScore(b, targetPostalCode) -
        geocodeResultScore(a, targetPostalCode),
    );
}

function geocodeResultScore(
  result: GeocodingResult,
  targetPostalCode?: string,
): number {
  let score = 0;
  const street = resolveGeocodeAddressLine1(result);
  if (street && looksLikeStreetAddress(street)) score = 3;
  else if (street) score = 2;
  else if (result.postalCode) score = 1;

  if (
    targetPostalCode &&
    result.postalCode &&
    postalCodesEqual(result.postalCode, targetPostalCode)
  ) {
    score += 10;
  }

  return score;
}

function isValidAddressLine1(
  value: string,
  context: { city?: string; name?: string } = {},
): boolean {
  const trimmed = value.trim();
  if (!trimmed || isPostalCodeLabel(trimmed)) return false;
  return looksLikeStreetAddress(trimmed, context);
}

function mergeAlignedField(
  current: string,
  fromResult: string,
  options: { addressWasCorrected: boolean; postalAligned: boolean },
): string {
  const result = fromResult.trim();
  const curr = current.trim();
  if (!result) return curr;
  if (!curr) return result;
  if (options.addressWasCorrected) return result;
  if (
    options.postalAligned &&
    curr.localeCompare(result, undefined, { sensitivity: "accent" }) !== 0
  ) {
    return result;
  }
  return curr;
}

function mergePostalField(current: string, fromResult: string): string {
  const result = fromResult.trim()
    ? normalizeCanadianPostalCode(fromResult)
    : "";
  const curr = current.trim();

  if (!result) return curr ? normalizeCanadianPostalCode(curr) : "";
  if (!curr) return result;
  if (!isValidCanadianPostalCode(curr)) return result;
  return resolveLookupPostalCode(curr, fromResult);
}

function mergeAddressLine1(current: string, result: GeocodingResult): string {
  const normalized = normalizeGeocodeResult(result);
  const context = { city: normalized.city };
  const street = resolveGeocodeAddressLine1(normalized);
  const streetLine =
    street && looksLikeStreetAddress(street, context) ? street : undefined;

  if (streetLine) {
    if (!isValidAddressLine1(current, context)) return streetLine;
    return current.trim();
  }

  if (!isValidAddressLine1(current, context)) return "";
  return current.trim();
}

function shouldBackfillField(current: string, fromResult: string): boolean {
  const curr = current.trim();
  const result = fromResult.trim();
  if (!result) return false;
  if (!curr) return true;
  return curr.localeCompare(result, undefined, { sensitivity: "accent" }) !== 0;
}

function backfillScalarField(
  current: string,
  fromResult: string,
  aggressive: boolean,
): string {
  const result = fromResult.trim();
  const curr = current.trim();
  if (!result) return curr;
  if (!curr) return result;
  if (aggressive && shouldBackfillField(curr, result)) return result;
  return curr;
}

/** Merge after an explicit geocode lookup — backfills empty or incorrect fields. */
export function mergeGeocodeLookupIntoAddressFields<
  T extends {
    addressLine1: string;
    city: string;
    province: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  },
>(
  current: T,
  result: GeocodingResult,
  lookup: {
    name?: string;
    postalCode?: string;
    addressLine1?: string;
  },
): T {
  const normalized = normalizeGeocodeResult(result);
  const context = {
    city: normalized.city || current.city,
    name: lookup.name?.trim(),
  };
  const street = resolveGeocodeAddressLine1(normalized);
  const streetLine =
    street && looksLikeStreetAddress(street, context) ? street : undefined;

  const lookupPostal = lookup.postalCode?.trim();
  const lookupUsedPostal = Boolean(
    lookupPostal && isValidCanadianPostalCode(lookupPostal),
  );
  const lookupUsedName = Boolean(lookup.name?.trim());
  const lookupUsedStreet = Boolean(
    lookup.addressLine1?.trim() &&
      looksLikeStreetAddress(lookup.addressLine1.trim(), context),
  );
  const trustedLookup = lookupUsedPostal || lookupUsedName || lookupUsedStreet;

  let postalCode = current.postalCode;
  if (normalized.postalCode) {
    const normalizedPostal = normalizeCanadianPostalCode(normalized.postalCode);
    if (
      !current.postalCode.trim() ||
      !isValidCanadianPostalCode(current.postalCode.trim())
    ) {
      postalCode = normalizedPostal;
    } else if (
      lookupUsedPostal &&
      lookupPostal &&
      postalCodesEqual(lookupPostal, normalized.postalCode)
    ) {
      postalCode = normalizedPostal;
    } else if (trustedLookup && shouldBackfillField(current.postalCode, normalizedPostal)) {
      postalCode = normalizedPostal;
    } else {
      postalCode = resolveLookupPostalCode(current.postalCode, normalized.postalCode);
    }
  }

  let addressLine1 = current.addressLine1.trim();
  if (streetLine) {
    if (!isValidAddressLine1(current.addressLine1, context)) {
      addressLine1 = streetLine;
    } else if (trustedLookup && shouldBackfillField(current.addressLine1, streetLine)) {
      addressLine1 = streetLine;
    }
  } else if (!isValidAddressLine1(current.addressLine1, context)) {
    addressLine1 = "";
  }

  return {
    ...current,
    addressLine1,
    postalCode,
    city: backfillScalarField(current.city, normalized.city ?? "", trustedLookup),
    province: backfillScalarField(
      current.province,
      normalized.province ?? "",
      trustedLookup,
    ),
    latitude: normalized.latitude,
    longitude: normalized.longitude,
  };
}

export function mergeGeocodeIntoAddressFields<
  T extends {
    addressLine1: string;
    city: string;
    province: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  },
>(current: T, result: GeocodingResult): T {
  const normalized = normalizeGeocodeResult(result);
  const addressLine1 = mergeAddressLine1(current.addressLine1, normalized);
  const addressWasCorrected =
    !isValidAddressLine1(current.addressLine1, {
      city: normalized.city,
    }) && isValidAddressLine1(addressLine1, {
      city: normalized.city,
    });
  const postalAligned = Boolean(
    normalized.postalCode &&
      current.postalCode.trim() &&
      isValidCanadianPostalCode(current.postalCode.trim()) &&
      postalCodesEqual(current.postalCode, normalized.postalCode),
  );
  const fieldContext = { addressWasCorrected, postalAligned };

  return {
    ...current,
    addressLine1,
    city: mergeAlignedField(current.city, normalized.city ?? "", fieldContext),
    province: mergeAlignedField(
      current.province,
      normalized.province ?? "",
      fieldContext,
    ),
    postalCode: mergePostalField(current.postalCode, normalized.postalCode),
    latitude: normalized.latitude,
    longitude: normalized.longitude,
  };
}

/** Merge reverse-geocode fields but keep the pin coordinates the user chose. */
export function mergeReverseGeocodeIntoAddressFields<
  T extends {
    addressLine1: string;
    city: string;
    province: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  },
>(current: T, result: GeocodingResult): T {
  const merged = mergeGeocodeIntoAddressFields(current, result);
  return {
    ...merged,
    latitude: current.latitude,
    longitude: current.longitude,
  };
}
