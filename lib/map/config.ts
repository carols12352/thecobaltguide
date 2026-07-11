export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";

export const MAP_TILES_API_KEY = process.env.NEXT_PUBLIC_MAP_TILES_API_KEY ?? "";

export function getMapStyleUrl(): string {
  const key = MAP_TILES_API_KEY;
  if (MAP_STYLE_URL.includes("{key}")) {
    return MAP_STYLE_URL.replace("{key}", key);
  }
  if (MAP_STYLE_URL.includes("maptiler.com") && key) {
    const separator = MAP_STYLE_URL.includes("?") ? "&" : "?";
    return `${MAP_STYLE_URL}${separator}key=${key}`;
  }
  return MAP_STYLE_URL;
}

export const DEFAULT_CENTER = {
  latitude: 43.6532,
  longitude: -79.3832,
} as const;

export const DEFAULT_BOUNDS = {
  north: 43.85,
  south: 43.58,
  east: -79.12,
  west: -79.64,
} as const;
