export type MapboxProximity = {
  longitude: number;
  latitude: number;
};

export function buildMapboxForwardGeocodeUrl(
  query: string,
  options: {
    accessToken: string;
    types: string;
    proximity?: MapboxProximity;
    limit?: number;
  },
): string {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("access_token", options.accessToken);
  url.searchParams.set("country", "ca");
  url.searchParams.set("types", options.types);
  url.searchParams.set("limit", String(options.limit ?? 10));

  if (options.proximity) {
    url.searchParams.set(
      "proximity",
      `${options.proximity.longitude},${options.proximity.latitude}`,
    );
  }

  return url.toString();
}
