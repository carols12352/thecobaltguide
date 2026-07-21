export interface GooglePlaceLookupInput {
  name: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

type GoogleTextSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    businessStatus?: string;
  }>;
};

export interface GooglePlaceMatch {
  placeId: string;
  googleName: string;
  confidence: "high" | "manual_review";
  distanceMeters: number | null;
  nameSimilarity: number;
  postalMatch: boolean;
  streetNumberMatch: boolean;
}

const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameSimilarity(leftValue: string, rightValue: string): number {
  const left = new Set(
    normalize(leftValue)
      .split(" ")
      .filter((part) => part.length > 1),
  );
  const right = new Set(
    normalize(rightValue)
      .split(" ")
      .filter((part) => part.length > 1),
  );
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const part of left) if (right.has(part)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

function compactPostalCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function streetNumber(value: string): string {
  return value.match(/\b\d+[A-Za-z]?\b/)?.[0]?.toLowerCase() ?? "";
}

function distanceMeters(
  sourceLatitude: number,
  sourceLongitude: number,
  targetLatitude: number,
  targetLongitude: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(targetLatitude - sourceLatitude);
  const longitudeDelta = radians(targetLongitude - sourceLongitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(sourceLatitude)) *
      Math.cos(radians(targetLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    6_371_000 *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export async function findGooglePlaceMatch(
  input: GooglePlaceLookupInput,
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
): Promise<GooglePlaceMatch | null> {
  if (!apiKey) return null;

  const textQuery = [
    input.name,
    input.addressLine1,
    input.city,
    input.province,
    input.postalCode,
    input.countryCode,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  if (!textQuery || !Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    return null;
  }

  try {
    const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus",
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 1,
        regionCode: input.countryCode.toLowerCase(),
        locationBias: {
          circle: {
            center: {
              latitude: input.latitude,
              longitude: input.longitude,
            },
            radius: 100,
          },
        },
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as GoogleTextSearchResponse;
    const place = data.places?.[0];
    const placeId = place?.id?.trim();
    if (!place || !placeId) return null;

    const googleName = place.displayName?.text?.trim() ?? "";
    const formattedAddress = place.formattedAddress?.trim() ?? "";
    const targetLatitude = place.location?.latitude;
    const targetLongitude = place.location?.longitude;
    const distance =
      Number.isFinite(targetLatitude) && Number.isFinite(targetLongitude)
        ? distanceMeters(
            input.latitude,
            input.longitude,
            targetLatitude as number,
            targetLongitude as number,
          )
        : null;
    const similarity = nameSimilarity(input.name, googleName);
    const expectedPostalCode = compactPostalCode(input.postalCode);
    const postalMatch = Boolean(
      expectedPostalCode &&
        compactPostalCode(formattedAddress).includes(expectedPostalCode),
    );
    const expectedStreetNumber = streetNumber(input.addressLine1);
    const streetNumberMatch = Boolean(
      expectedStreetNumber &&
        streetNumber(formattedAddress) === expectedStreetNumber,
    );
    const highConfidence =
      place.businessStatus !== "CLOSED_PERMANENTLY" &&
      distance !== null &&
      distance <= 150 &&
      similarity >= 0.5 &&
      (postalMatch || streetNumberMatch);

    return {
      placeId: placeId.slice(0, 255),
      googleName,
      confidence: highConfidence ? "high" : "manual_review",
      distanceMeters: distance === null ? null : Math.round(distance),
      nameSimilarity: Number(similarity.toFixed(2)),
      postalMatch,
      streetNumberMatch,
    };
  } catch {
    return null;
  }
}

/** Return only verified high-confidence IDs; ambiguous candidates keep the safe URL fallback. */
export async function findGooglePlaceId(
  input: GooglePlaceLookupInput,
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
): Promise<string | null> {
  const match = await findGooglePlaceMatch(input, apiKey);
  return match?.confidence === "high" ? match.placeId : null;
}
