import { MAP_DEFAULTS } from "@/config/constants";

/** Whether the map is zoomed in enough to load merchants and show the in-view list. */
export function isCityLevelZoom(zoom: number): boolean {
  return Math.floor(zoom) >= MAP_DEFAULTS.minInViewZoom;
}
