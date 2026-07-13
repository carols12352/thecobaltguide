import { looksLikeStreetAddress } from "@/lib/geocoding/address-query";
import {
  isValidCanadianPostalCode,
  normalizeCanadianPostalCode,
} from "@/lib/validation/canadian-postal-code";
import type { GeocodingResult } from "@/types/domain";

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

/** Street or place label suitable for address line 1 — never a postal code. */
export function resolveGeocodeAddressLine1(
  result: GeocodingResult,
): string | undefined {
  const candidates = [result.addressLine1, result.name].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed || isPostalCodeLabel(trimmed)) continue;
    if (looksLikeStreetAddress(trimmed)) return trimmed;
  }

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed && !isPostalCodeLabel(trimmed)) return trimmed;
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
  const street = resolveGeocodeAddressLine1(normalized);
  const streetLine =
    street && looksLikeStreetAddress(street) ? street : undefined;

  return {
    ...current,
    addressLine1:
      streetLine ??
      (looksLikeStreetAddress(current.addressLine1) ? current.addressLine1 : ""),
    city: normalized.city || current.city,
    province: normalized.province || current.province,
    postalCode: resolveLookupPostalCode(current.postalCode, normalized.postalCode),
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
