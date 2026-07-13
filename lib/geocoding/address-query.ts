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

export type StructuredAddressInput = {
  name?: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode?: string;
};

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
export function looksLikeStreetAddress(addressLine1: string): boolean {
  const trimmed = addressLine1.trim();
  if (!trimmed) return false;
  if (/^\d+\s/.test(trimmed)) return true;

  const tokens = trimmed.toLowerCase().split(/\s+/);
  return tokens.some((token) => isStreetSuffix(token));
}

/** Street-address queries — skipped when the line is a business name. */
export function buildAddressGeocodeQueries(
  input: StructuredAddressInput,
): string[] {
  if (!looksLikeStreetAddress(input.addressLine1 ?? "")) return [];

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

/** All queries in priority order. */
export function buildGeocodeQueries(input: StructuredAddressInput): string[] {
  const name = input.name?.trim();
  const queries = [
    ...buildAddressGeocodeQueries(input),
    ...buildPostalGeocodeQueries(input),
  ];

  if (name && input.postalCode?.trim()) {
    queries.push(
      buildQuery([
        name,
        input.postalCode.trim(),
        input.city?.trim(),
        input.province?.trim(),
        "Canada",
      ]),
    );
  }

  return uniqueQueries(queries);
}
