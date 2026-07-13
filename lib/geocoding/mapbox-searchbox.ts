import { normalizeAddressLine } from "@/lib/geocoding/address-query";
import type { MapboxProximity } from "@/lib/geocoding/mapbox-search";
import type { GeocodingResult } from "@/types/domain";

type SearchBoxAddressContext = {
  name?: string;
  address_number?: string;
  street_name?: string;
};

type SearchBoxFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name: string;
    mapbox_id: string;
    feature_type: string;
    full_address?: string;
    address?: string;
    context?: {
      place?: { name?: string };
      postcode?: { name?: string };
      address?: SearchBoxAddressContext;
    };
    coordinates?: { latitude: number; longitude: number };
  };
};

export function buildMapboxSearchBoxForwardUrl(
  query: string,
  options: {
    accessToken: string;
    types?: string;
    proximity?: MapboxProximity;
    limit?: number;
  },
): string {
  const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
  url.searchParams.set("q", query);
  url.searchParams.set("access_token", options.accessToken);
  url.searchParams.set("country", "ca");
  url.searchParams.set("types", options.types ?? "poi");
  url.searchParams.set("limit", String(options.limit ?? 10));

  if (options.proximity) {
    url.searchParams.set(
      "proximity",
      `${options.proximity.longitude},${options.proximity.latitude}`,
    );
  }

  return url.toString();
}

function streetLineFromSearchBoxContext(
  address?: SearchBoxAddressContext,
): string {
  if (!address) return "";

  const number = address.address_number?.trim();
  const street = address.street_name?.trim();
  if (number && street) {
    return normalizeAddressLine(`${number} ${street}`);
  }

  const name = address.name?.trim();
  if (name && looksLikeNumberedStreet(name)) {
    return normalizeAddressLine(name);
  }

  return name ? normalizeAddressLine(name) : "";
}

function looksLikeNumberedStreet(value: string): boolean {
  return /^\d+\s/.test(value.trim());
}

export function mapMapboxSearchBoxFeature(
  feature: SearchBoxFeature,
  options?: { fallbackProvince?: string },
): GeocodingResult {
  const props = feature.properties;
  const ctx = props.context ?? {};
  const addressCtx = ctx.address;
  const streetLine =
    streetLineFromSearchBoxContext(addressCtx) ||
    (props.address?.trim() && looksLikeNumberedStreet(props.address)
      ? normalizeAddressLine(props.address)
      : "");

  const [longitude, latitude] = feature.geometry.coordinates;
  const coords = props.coordinates;

  return {
    name: props.name.trim(),
    addressLine1: streetLine,
    city: ctx.place?.name?.trim() ?? "",
    province: options?.fallbackProvince?.trim() ?? "",
    postalCode: ctx.postcode?.name?.trim() ?? "",
    countryCode: "CA",
    latitude: coords?.latitude ?? latitude,
    longitude: coords?.longitude ?? longitude,
    externalPlaceId: `poi.${props.mapbox_id}`,
    geocodeLabel: props.full_address?.trim() || undefined,
  };
}
