/** Approximate bounding box for Canada (including southern border communities). */
export const CANADA_BOUNDS = {
  north: 83.5,
  south: 41.0,
  east: -52.0,
  west: -141.5,
} as const;

export function isInCanada(latitude: number, longitude: number): boolean {
  return (
    latitude >= CANADA_BOUNDS.south &&
    latitude <= CANADA_BOUNDS.north &&
    longitude >= CANADA_BOUNDS.west &&
    longitude <= CANADA_BOUNDS.east
  );
}
