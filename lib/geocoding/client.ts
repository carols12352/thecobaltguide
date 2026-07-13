import type { GeocodingResult } from "@/types/domain";
import { looksLikeStreetAddress } from "@/lib/geocoding/address-query";
import {
  mergeGeocodeIntoAddressFields,
  mergeReverseGeocodeIntoAddressFields,
  resolveGeocodeAddressLine1,
} from "@/lib/geocoding/parse-result";
import type { geocodeQuerySchema } from "@/server/validation/schemas";
import type { z } from "zod";

type GeocodeQuery = z.infer<typeof geocodeQuerySchema>;

export type GeocodeLookupResult = {
  results: GeocodingResult[];
  source: "address" | "postal" | null;
};

export function geocodeParamsFromForm(input: {
  name?: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode: string;
}): GeocodeQuery {
  const streetAddress = looksLikeStreetAddress(input.addressLine1 ?? "")
    ? input.addressLine1
    : undefined;

  return {
    name: input.name?.trim() || undefined,
    city: input.city?.trim() || undefined,
    province: input.province?.trim() || undefined,
    postalCode: input.postalCode.trim(),
    addressLine1: streetAddress,
  };
}

export function buildGeocodeSearchParams(input: GeocodeQuery): URLSearchParams {
  const params = new URLSearchParams({
    postalCode: input.postalCode,
  });

  if (input.city) params.set("city", input.city);
  if (input.province) params.set("province", input.province);
  if (input.addressLine1) params.set("addressLine1", input.addressLine1);
  if (input.name) params.set("name", input.name);

  return params;
}

export async function fetchGeocodeLookup(
  input: GeocodeQuery,
): Promise<GeocodeLookupResult> {
  const res = await fetch(`/api/geocode?${buildGeocodeSearchParams(input)}`);
  if (!res.ok) {
    throw new Error("Geocode request failed");
  }

  const data = await res.json();
  return {
    results: (data.results ?? []) as GeocodingResult[],
    source: data.source ?? null,
  };
}

export function geocodeSuccessMessage(
  source: GeocodeLookupResult["source"],
  result: GeocodingResult,
): string {
  const street = resolveGeocodeAddressLine1(result);
  if (street) {
    return `Location found. Address updated to ${street}. Drag the pin if needed.`;
  }
  if (source === "postal") {
    return "Location found from postal code. Coordinates updated — enter or pick a street address if needed.";
  }
  return "Location found. Coordinates updated — drag the pin if needed.";
}

export async function fetchReverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  const res = await fetch(`/api/geocode/reverse?${params}`);
  if (!res.ok) {
    throw new Error("Reverse geocode request failed");
  }

  const data = await res.json();
  return (data.results ?? []) as GeocodingResult[];
}

export {
  mergeGeocodeIntoAddressFields,
  mergeReverseGeocodeIntoAddressFields,
  resolveGeocodeAddressLine1,
};
