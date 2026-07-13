/** Coarse grid step for caching map-center → city lookups (~5.5 km lat). */
export const CITY_RESOLVE_GRID_STEP = 0.05;

export function cityResolveGridKey(
  latitude: number,
  longitude: number,
  step = CITY_RESOLVE_GRID_STEP,
): string {
  const scale = Math.round(1 / step);
  const lat = Math.round(latitude * scale) / scale;
  const lng = Math.round(longitude * scale) / scale;
  return `${lat}:${lng}`;
}
