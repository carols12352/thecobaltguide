import { describe, expect, it } from "vitest";
import {
  cityFromMapboxPlaceName,
  streetFromMapboxPlaceName,
} from "@/lib/geocoding/mapbox-feature";

describe("streetFromMapboxPlaceName", () => {
  it("extracts street from Mapbox POI place_name", () => {
    expect(
      streetFromMapboxPlaceName(
        "Kabob Place, 140 University Avenue West, Waterloo, Ontario N2L 6E1, Canada",
      ),
    ).toBe("140 University Avenue West");
  });

  it("returns empty when no street segment exists", () => {
    expect(
      streetFromMapboxPlaceName("Kabob Place, Waterloo, Ontario N2L 0G2, Canada"),
    ).toBe("");
  });
});

describe("cityFromMapboxPlaceName", () => {
  it("extracts city from Mapbox POI place_name", () => {
    expect(
      cityFromMapboxPlaceName(
        "Farah Foods, 140 University Avenue West, Waterloo, Ontario N2L 3G1, Canada",
      ),
    ).toBe("Waterloo");
  });
});
