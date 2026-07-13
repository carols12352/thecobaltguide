import { describe, expect, it } from "vitest";
import {
  buildBusinessPoiSearchQueries,
  buildCityCentroidQuery,
  buildNameCityGeocodeQueries,
} from "@/lib/geocoding/address-query";
import { buildMapboxForwardGeocodeUrl } from "@/lib/geocoding/mapbox-search";

describe("buildBusinessPoiSearchQueries", () => {
  it("leads with bare merchant name when city is provided", () => {
    expect(
      buildBusinessPoiSearchQueries({
        name: "Farah Foods",
        city: "Waterloo",
        province: "ON",
      }),
    ).toEqual([
      "Farah Foods",
      "Farah Foods, Waterloo, ON, Canada",
      "Farah Foods, Waterloo, Canada",
    ]);
  });

  it("does not include country-only query when city is provided", () => {
    expect(
      buildNameCityGeocodeQueries({
        name: "Farah Foods",
        city: "Waterloo",
        province: "ON",
      }),
    ).not.toContain("Farah Foods, Canada");
  });
});

describe("buildCityCentroidQuery", () => {
  it("builds a city centroid lookup string", () => {
    expect(
      buildCityCentroidQuery({ city: "Waterloo", province: "ON" }),
    ).toBe("Waterloo, ON, Canada");
  });
});

describe("buildMapboxForwardGeocodeUrl", () => {
  it("includes proximity when biasing POI search to a city", () => {
    const url = buildMapboxForwardGeocodeUrl("Farah Foods", {
      accessToken: "test-token",
      types: "poi",
      proximity: { longitude: -80.49, latitude: 43.46 },
    });

    expect(url).toContain(encodeURIComponent("Farah Foods"));
    expect(url).toContain("types=poi");
    expect(url).toContain("proximity=-80.49%2C43.46");
    expect(url).toContain("country=ca");
  });
});
