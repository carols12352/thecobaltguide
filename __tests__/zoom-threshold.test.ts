import { describe, expect, it } from "vitest";
import { MAP_DEFAULTS } from "@/config/constants";
import { isCityLevelZoom } from "@/lib/map/zoom-threshold";

describe("isCityLevelZoom", () => {
  it("shows the in-view list only at neighborhood zoom", () => {
    expect(MAP_DEFAULTS.minInViewZoom).toBe(13);
    expect(isCityLevelZoom(12.9)).toBe(false);
    expect(isCityLevelZoom(11)).toBe(false);
    expect(isCityLevelZoom(13)).toBe(true);
  });
});
