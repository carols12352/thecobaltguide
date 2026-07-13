export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface AlignedViewport extends ViewportBounds {
  gridKey: string;
  zoom: number;
}

/** Grid cell size in degrees; coarser when zoomed out. */
export function getGridStepDegrees(zoom: number): number {
  const z = Math.floor(zoom);
  if (z <= 10) return 0.2;
  if (z <= 12) return 0.1;
  if (z <= 14) return 0.05;
  if (z <= 16) return 0.025;
  return 0.0125;
}

function gridScale(step: number): number {
  return Math.round(1 / step);
}

function snapDown(value: number, step: number): number {
  const scale = gridScale(step);
  return Math.floor(value * scale) / scale;
}

function snapUp(value: number, step: number): number {
  const scale = gridScale(step);
  return Math.ceil(value * scale) / scale;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function boundsToGridKey(
  bounds: ViewportBounds,
  zoom: number,
  step: number,
): string {
  const scale = gridScale(step);
  const rowNorth = Math.round(bounds.north * scale);
  const rowSouth = Math.round(bounds.south * scale);
  const colEast = Math.round(bounds.east * scale);
  const colWest = Math.round(bounds.west * scale);
  return `${zoom}:${rowSouth}-${rowNorth}:${colWest}-${colEast}`;
}

/** Expand viewport by one grid cell, then snap to the grid for stable cache keys. */
export function alignViewportToGrid(viewport: ViewportBounds & { zoom: number }): AlignedViewport {
  const zoom = Math.floor(viewport.zoom);
  const step = getGridStepDegrees(zoom);
  const pad = step;

  const bounds: ViewportBounds = {
    north: clamp(snapUp(viewport.north + pad, step), -90, 90),
    south: clamp(snapDown(viewport.south - pad, step), -90, 90),
    east: clamp(snapUp(viewport.east + pad, step), -180, 180),
    west: clamp(snapDown(viewport.west - pad, step), -180, 180),
  };

  return {
    ...bounds,
    gridKey: boundsToGridKey(bounds, zoom, step),
    zoom,
  };
}

/** Snap bounds outward to grid lines only (no extra padding). Idempotent on aligned bounds. */
export function normalizeBoundsToGrid(bounds: ViewportBounds, zoom: number): ViewportBounds {
  const z = Math.floor(zoom);
  const step = getGridStepDegrees(z);
  return {
    north: clamp(snapUp(bounds.north, step), -90, 90),
    south: clamp(snapDown(bounds.south, step), -90, 90),
    east: clamp(snapUp(bounds.east, step), -180, 180),
    west: clamp(snapDown(bounds.west, step), -180, 180),
  };
}

/** Grid key for bounds already expanded on the client — no extra padding. */
export function gridKeyForBounds(bounds: ViewportBounds, zoom: number): string {
  const z = Math.floor(zoom);
  const step = getGridStepDegrees(z);
  return boundsToGridKey(bounds, z, step);
}

/** Stable cache key for a snapped on-screen viewport. */
export function viewBoundsGridKey(bounds: ViewportBounds, zoom: number): string {
  const z = Math.floor(zoom);
  const normalized = normalizeBoundsToGrid(bounds, z);
  return gridKeyForBounds(normalized, z);
}

/** Resolve map cache params from viewport query (server-side). Bounds are normalized to grid. */
export function mapViewportFromQuery(query: ViewportBounds & { zoom?: number }): {
  bounds: ViewportBounds;
  gridKey: string;
  zoom: number;
} {
  const zoom = Math.floor(query.zoom ?? 13);
  const bounds = normalizeBoundsToGrid(
    {
      north: query.north,
      south: query.south,
      east: query.east,
      west: query.west,
    },
    zoom,
  );
  return {
    bounds,
    gridKey: gridKeyForBounds(bounds, zoom),
    zoom,
  };
}

export function boundsContains(outer: ViewportBounds, inner: ViewportBounds): boolean {
  return (
    inner.north <= outer.north &&
    inner.south >= outer.south &&
    inner.east <= outer.east &&
    inner.west >= outer.west
  );
}

export function filterPlacesInBounds<T extends { latitude: number; longitude: number }>(
  places: T[],
  bounds: ViewportBounds,
): T[] {
  return places.filter(
    (place) =>
      place.latitude <= bounds.north &&
      place.latitude >= bounds.south &&
      place.longitude <= bounds.east &&
      place.longitude >= bounds.west,
  );
}

export function getMapViewportBounds(map: {
  getBounds: () => {
    getNorth: () => number;
    getSouth: () => number;
    getEast: () => number;
    getWest: () => number;
  };
}): ViewportBounds {
  const bounds = map.getBounds();
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}
