import { describe, expect, it } from "vitest";
import { parseGeoLocation } from "@/lib/map/parse-location";

describe("parseGeoLocation", () => {
  it("parses Supabase HEXEWKB geography strings", () => {
    const coords = parseGeoLocation(
      "0101000020e6100000cd3b4ed191d853c0cff753e3a5d34540",
    );

    expect(coords).not.toBeNull();
    expect(coords!.longitude).toBeCloseTo(-79.3839, 4);
    expect(coords!.latitude).toBeCloseTo(43.6535, 4);
  });

  it("parses GeoJSON objects", () => {
    const coords = parseGeoLocation({
      type: "Point",
      coordinates: [-79.3839, 43.6535],
    });

    expect(coords).toEqual({
      longitude: -79.3839,
      latitude: 43.6535,
    });
  });

  it("parses EWKT POINT strings", () => {
    const coords = parseGeoLocation("POINT(-79.3839 43.6535)");

    expect(coords).toEqual({
      longitude: -79.3839,
      latitude: 43.6535,
    });
  });
});
