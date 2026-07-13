const STREET_SUFFIXES = new Set([
  "st",
  "street",
  "rd",
  "road",
  "ave",
  "avenue",
  "blvd",
  "boulevard",
  "dr",
  "drive",
  "ct",
  "court",
  "ln",
  "lane",
  "way",
  "pl",
  "place",
  "cres",
  "crescent",
  "trl",
  "trail",
  "pkwy",
  "parkway",
  "hwy",
  "highway",
]);

const DIRECTIONS = new Set([
  "n",
  "north",
  "s",
  "south",
  "e",
  "east",
  "w",
  "west",
  "ne",
  "nw",
  "se",
  "sw",
]);

const ABBREVIATIONS: Record<string, string> = {
  st: "Street",
  street: "Street",
  rd: "Road",
  road: "Road",
  ave: "Avenue",
  avenue: "Avenue",
  blvd: "Boulevard",
  boulevard: "Boulevard",
  dr: "Drive",
  drive: "Drive",
  ct: "Court",
  court: "Court",
  ln: "Lane",
  lane: "Lane",
  pl: "Place",
  place: "Place",
  cres: "Crescent",
  crescent: "Crescent",
  hwy: "Highway",
  highway: "Highway",
  n: "North",
  north: "North",
  s: "South",
  south: "South",
  e: "East",
  east: "East",
  w: "West",
  west: "West",
  ne: "Northeast",
  nw: "Northwest",
  se: "Southeast",
  sw: "Southwest",
};

export type GeocodeMatchTier = "postal" | "address" | "name";

export type StructuredAddressInput = {
  name?: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode?: string;
};

export type StreetAddressContext = {
  city?: string;
  name?: string;
};

function normalizeComparable(value: string): string {
  return value.trim().toLocaleLowerCase("en-CA");
}

/** Street name tokens before suffix/direction, e.g. "Waterloo" from "Waterloo Street". */
export function extractStreetNamePart(addressLine1: string): string {
  const trimmed = addressLine1.trim();
  if (!trimmed) return "";

  const tokens = trimmed.split(/\s+/);
  let end = tokens.length;
  if (end > 0 && isDirection(tokens[end - 1]!)) end -= 1;
  if (end > 0 && isStreetSuffix(tokens[end - 1]!)) end -= 1;

  return tokens.slice(0, end).join(" ");
}

/** Street named after the city itself (e.g. "Waterloo Street" in Waterloo) — geocoder noise for POI search. */
export function looksLikeCityNameStreetNoise(
  addressLine1: string,
  city: string,
): boolean {
  const trimmed = addressLine1.trim();
  if (!trimmed || /^\d+\s/.test(trimmed)) return false;

  const streetName = extractStreetNamePart(trimmed);
  const normalizedCity = city.trim();
  if (!streetName || !normalizedCity) return false;

  return (
    normalizeComparable(streetName) === normalizeComparable(normalizedCity) &&
    trimmed.split(/\s+/).some((token) => isStreetSuffix(token))
  );
}

/** Suffix-only lines like "Waterloo Street" without a house number when city differs. */
export function looksLikeCityDerivedStreetLine(
  addressLine1: string,
  context: StreetAddressContext = {},
): boolean {
  const trimmed = addressLine1.trim();
  if (!trimmed || /^\d+\s/.test(trimmed)) return false;

  const city = context.city?.trim();
  if (!city) return false;

  const streetName = extractStreetNamePart(trimmed);
  if (!streetName) return false;

  const tokens = trimmed.split(/\s+/);
  const hasSuffix = tokens.some((token) => isStreetSuffix(token));
  if (!hasSuffix || tokens.length > 3) return false;

  return normalizeComparable(streetName) !== normalizeComparable(city);
}

/** True when a form line is the same as the city or merchant name, not a street. */
export function isCityOrNameLine(
  line: string,
  context: StreetAddressContext = {},
): boolean {
  const normalized = normalizeComparable(line);
  if (!normalized) return false;

  const city = context.city?.trim();
  if (city && normalized === normalizeComparable(city)) return true;

  const name = context.name?.trim();
  if (name && normalized === normalizeComparable(name)) return true;

  return false;
}

/** True when the line looks like a city/province label rather than a street address. */
export function looksLikeCityLabel(
  line: string,
  context: StreetAddressContext = {},
): boolean {
  const trimmed = line.trim();
  if (!trimmed || /^\d+\s/.test(trimmed)) return false;
  if (isCityOrNameLine(trimmed, context)) return true;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 2) {
    const [first, second] = tokens;
    const provincePattern = /^[A-Z]{2}$/i;
    if (
      first &&
      second &&
      provincePattern.test(second) &&
      !tokens.some((token) => isStreetSuffix(token))
    ) {
      return true;
    }
  }

  return false;
}

const GEOCODE_TIER_ORDER: GeocodeMatchTier[] = ["postal", "address", "name"];

export function geocodeResultKey(result: {
  externalPlaceId: string;
  latitude: number;
  longitude: number;
}): string {
  return result.externalPlaceId || `${result.latitude},${result.longitude}`;
}

export function dedupeGeocodeResults<
  T extends { externalPlaceId: string; latitude: number; longitude: number },
>(results: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const result of results) {
    const key = geocodeResultKey(result);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

export function mergeGeocodeResultsByTier<
  T extends { externalPlaceId: string; latitude: number; longitude: number },
>(
  tiered: Record<GeocodeMatchTier, T[]>,
  options?: { maxPerTier?: number; maxTotal?: number },
): T[] {
  const maxPerTier = options?.maxPerTier ?? 5;
  const maxTotal = options?.maxTotal ?? 10;
  const merged: T[] = [];
  const seen = new Set<string>();

  for (const tier of GEOCODE_TIER_ORDER) {
    const batch = tiered[tier].slice(0, maxPerTier);
    for (const result of batch) {
      const key = geocodeResultKey(result);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(result);
      if (merged.length >= maxTotal) return merged;
    }
  }

  return merged;
}

function isStreetSuffix(token: string): boolean {
  return STREET_SUFFIXES.has(token.toLowerCase());
}

function isDirection(token: string): boolean {
  return DIRECTIONS.has(token.toLowerCase());
}

function expandToken(token: string): string {
  return ABBREVIATIONS[token.toLowerCase()] ?? token;
}

/** Expand common street abbreviations and normalize spacing. */
export function normalizeAddressLine(addressLine1: string): string {
  const tokens = addressLine1.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  return tokens.map(expandToken).join(" ");
}

/**
 * If a street name was split ("Bridge Port" -> "Bridgeport"), return a merged variant.
 * Only merges consecutive name tokens that are not suffixes or directions.
 */
export function mergeSplitStreetName(addressLine1: string): string | null {
  const match = addressLine1.trim().match(/^(\d+)\s+(.+)$/);
  if (!match) return null;

  const houseNumber = match[1];
  const tokens = match[2].split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return null;

  let end = tokens.length;
  if (isDirection(tokens[end - 1])) end -= 1;
  if (end > 0 && isStreetSuffix(tokens[end - 1])) end -= 1;

  const nameTokens = tokens.slice(0, end);
  if (nameTokens.length !== 2) return null;
  if (isStreetSuffix(nameTokens[0]) || isStreetSuffix(nameTokens[1])) return null;
  if (isDirection(nameTokens[0]) || isDirection(nameTokens[1])) return null;

  const mergedName = `${nameTokens[0]}${nameTokens[1]}`.toLowerCase();
  const tail = tokens.slice(end).map(expandToken);
  return [houseNumber, mergedName, ...tail].join(" ");
}

function buildQuery(parts: Array<string | undefined>): string {
  return parts.filter((part) => part && part.trim()).join(", ");
}

function uniqueQueries(queries: string[]): string[] {
  return queries.filter((query, index) => queries.indexOf(query) === index);
}

function addressVariants(addressLine1?: string): string[] {
  if (!addressLine1?.trim()) return [];

  return [
    addressLine1.trim(),
    normalizeAddressLine(addressLine1),
    mergeSplitStreetName(addressLine1),
    mergeSplitStreetName(normalizeAddressLine(addressLine1)),
  ].filter(
    (value, index, all): value is string =>
      Boolean(value) && all.indexOf(value) === index,
  );
}

/** True when the line looks like a street address rather than a business name. */
export function looksLikeStreetAddress(
  addressLine1: string,
  context: StreetAddressContext = {},
): boolean {
  const trimmed = addressLine1.trim();
  if (!trimmed) return false;
  if (isCityOrNameLine(trimmed, context)) return false;
  if (looksLikeCityLabel(trimmed, context)) return false;
  if (looksLikeCityDerivedStreetLine(trimmed, context)) return false;
  if (/^\d+\s/.test(trimmed)) return true;

  const tokens = trimmed.toLowerCase().split(/\s+/);
  const lastToken = tokens[tokens.length - 1] ?? "";

  // "Something Place" without a house number is usually a POI/business name.
  if (lastToken === "place" && tokens.length === 2) {
    return false;
  }

  return tokens.some((token) => isStreetSuffix(token));
}

/** Street-address queries — skipped when the line is a business name. */
export function buildAddressGeocodeQueries(
  input: StructuredAddressInput,
): string[] {
  const context = { city: input.city, name: input.name };
  if (!looksLikeStreetAddress(input.addressLine1 ?? "", context)) return [];

  const city = input.city?.trim() ?? "";
  const province = input.province?.trim() ?? "";
  const postalCode = input.postalCode?.trim() || "";
  const variants = addressVariants(input.addressLine1);
  const queries: string[] = [];

  for (const addressLine1 of variants) {
    if (postalCode) {
      queries.push(
        buildQuery([addressLine1, postalCode, city, province, "Canada"]),
        buildQuery([addressLine1, postalCode, "Canada"]),
      );
    }
    queries.push(buildQuery([addressLine1, city, province, "Canada"]));
  }

  return uniqueQueries(queries);
}

/** Merchant-name queries — POI / business lookup when no street address is given. */
export function buildNameGeocodeQueries(
  input: StructuredAddressInput,
): string[] {
  const name = input.name?.trim();
  if (!name) return [];

  const city = input.city?.trim() ?? "";
  const province = input.province?.trim() ?? "";
  const postalCode = input.postalCode?.trim() || "";

  return uniqueQueries([
    buildQuery([name, postalCode, city, province, "Canada"]),
    buildQuery([name, city, province, "Canada"]),
    buildQuery([name, "Canada"]),
  ]);
}

/** Merchant name + city queries — lowest-priority tier; postal code is omitted. */
export function buildNameCityGeocodeQueries(
  input: StructuredAddressInput,
): string[] {
  const name = input.name?.trim();
  if (!name) return [];

  const city = input.city?.trim() ?? "";
  const province = input.province?.trim() ?? "";

  const queries = [
    buildQuery([name, city, province, "Canada"]),
    buildQuery([name, city, "Canada"]),
  ];

  if (!city) {
    queries.push(buildQuery([name, "Canada"]));
  }

  return uniqueQueries(queries.filter(Boolean));
}

/** Query used to resolve a city centroid for Mapbox proximity biasing. */
export function buildCityCentroidQuery(
  input: StructuredAddressInput,
): string | null {
  const city = input.city?.trim();
  if (!city) return null;
  return buildQuery([city, input.province?.trim(), "Canada"]);
}

/**
 * Business POI search queries. When city is known, lead with the bare merchant
 * name so Mapbox proximity (set separately) can anchor results to that city.
 */
export function buildBusinessPoiSearchQueries(
  input: StructuredAddressInput,
): string[] {
  const name = input.name?.trim();
  if (!name) return [];

  if (input.city?.trim()) {
    return uniqueQueries([name, ...buildNameCityGeocodeQueries(input)]);
  }

  return buildNameCityGeocodeQueries(input);
}

export function buildGeocodeQueriesForTier(
  tier: GeocodeMatchTier,
  input: StructuredAddressInput,
): string[] {
  switch (tier) {
    case "postal":
      return buildPostalGeocodeQueries(input);
    case "address":
      return buildAddressGeocodeQueries(input);
    case "name":
      return buildNameCityGeocodeQueries(input);
  }
}

/** Postal-code queries — fallback when address lookup fails or is unavailable. */
export function buildPostalGeocodeQueries(
  input: StructuredAddressInput,
): string[] {
  const city = input.city?.trim() ?? "";
  const province = input.province?.trim() ?? "";
  const postalCode = input.postalCode?.trim() || "";
  if (!postalCode) return [];

  return uniqueQueries([
    buildQuery([postalCode, city, province, "Canada"]),
    buildQuery([postalCode, "Canada"]),
  ]);
}

/** Address search biased toward a postal-code centroid. */
export function buildPostalStreetSearchQuery(
  input: StructuredAddressInput,
): string | null {
  const postalCode = input.postalCode?.trim();
  if (!postalCode) return null;

  return buildQuery([
    postalCode,
    input.city?.trim(),
    input.province?.trim(),
    "Canada",
  ]);
}

/** All queries in priority order: postal, address, then name + city. */
export function buildGeocodeQueries(input: StructuredAddressInput): string[] {
  return uniqueQueries([
    ...buildPostalGeocodeQueries(input),
    ...buildAddressGeocodeQueries(input),
    ...buildNameCityGeocodeQueries(input),
  ]);
}
