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
  places?: Array<{ id?: string }>;
};

const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

export async function findGooglePlaceId(
  input: GooglePlaceLookupInput,
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
): Promise<string | null> {
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
        "X-Goog-FieldMask": "places.id",
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
    const placeId = data.places?.[0]?.id?.trim();
    return placeId ? placeId.slice(0, 255) : null;
  } catch {
    return null;
  }
}
