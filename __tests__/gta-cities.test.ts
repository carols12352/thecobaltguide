import { describe, expect, it } from "vitest";
import { resolveCityFromPoint } from "@/lib/map/gta-cities";

describe("resolveCityFromPoint", () => {
  it("resolves Toronto from downtown coordinates", () => {
    expect(resolveCityFromPoint(43.6532, -79.3832)).toEqual({
      city: "Toronto",
      province: "ON",
    });
  });

  it("returns null outside supported GTA regions", () => {
    expect(resolveCityFromPoint(45.5017, -73.5673)).toBeNull();
  });
});
