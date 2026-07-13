export interface CityRegion {
  city: string;
  province: string;
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Approximate GTA municipality bounds for map-center city resolution. */
export const GTA_CITY_REGIONS: CityRegion[] = [
  { city: "Toronto", province: "ON", north: 43.855, south: 43.58, east: -79.105, west: -79.639 },
  { city: "Mississauga", province: "ON", north: 43.65, south: 43.47, east: -79.52, west: -79.85 },
  { city: "Markham", province: "ON", north: 43.92, south: 43.78, east: -79.22, west: -79.42 },
  { city: "Vaughan", province: "ON", north: 43.92, south: 43.75, east: -79.42, west: -79.65 },
  { city: "Brampton", province: "ON", north: 43.78, south: 43.6, east: -79.62, west: -80.08 },
  { city: "Oakville", province: "ON", north: 43.52, south: 43.38, east: -79.62, west: -79.82 },
  { city: "Burlington", province: "ON", north: 43.41, south: 43.28, east: -79.72, west: -79.92 },
  { city: "Richmond Hill", province: "ON", north: 43.92, south: 43.82, east: -79.35, west: -79.48 },
  { city: "Pickering", province: "ON", north: 43.92, south: 43.78, east: -79.05, west: -79.2 },
  { city: "Ajax", province: "ON", north: 43.9, south: 43.8, east: -79.0, west: -79.15 },
  { city: "Whitby", province: "ON", north: 43.95, south: 43.82, east: -78.88, west: -79.05 },
  { city: "Oshawa", province: "ON", north: 43.98, south: 43.85, east: -78.78, west: -78.95 },
  { city: "Hamilton", province: "ON", north: 43.35, south: 43.18, east: -79.72, west: -80.05 },
];

function regionArea(region: CityRegion): number {
  return (region.north - region.south) * (region.east - region.west);
}

function pointInRegion(lat: number, lng: number, region: CityRegion): boolean {
  return (
    lat <= region.north &&
    lat >= region.south &&
    lng <= region.east &&
    lng >= region.west
  );
}

/** Resolve the GTA city under a map center point. */
export function resolveCityFromPoint(
  latitude: number,
  longitude: number,
): Pick<CityRegion, "city" | "province"> | null {
  const matches = GTA_CITY_REGIONS.filter((region) =>
    pointInRegion(latitude, longitude, region),
  );
  if (matches.length >= 1) {
    const smallest = matches.sort((a, b) => regionArea(a) - regionArea(b))[0];
    return { city: smallest.city, province: smallest.province };
  }

  let nearest: CityRegion | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const region of GTA_CITY_REGIONS) {
    const centerLat = (region.north + region.south) / 2;
    const centerLng = (region.east + region.west) / 2;
    const distance =
      (latitude - centerLat) ** 2 + (longitude - centerLng) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = region;
    }
  }

  // ~35 km — still attribute to the closest GTA municipality when near the edge.
  if (nearest && nearestDistance <= 0.15 ** 2) {
    return { city: nearest.city, province: nearest.province };
  }

  return null;
}

export function getCityRegion(
  city: string,
  province: string,
): CityRegion | undefined {
  return GTA_CITY_REGIONS.find(
    (region) =>
      region.city.toLowerCase() === city.toLowerCase() &&
      region.province.toUpperCase() === province.toUpperCase(),
  );
}
