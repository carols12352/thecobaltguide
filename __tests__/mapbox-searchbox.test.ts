import { describe, expect, it } from "vitest";
import {
  buildMapboxSearchBoxForwardUrl,
  mapMapboxSearchBoxFeature,
} from "@/lib/geocoding/mapbox-searchbox";

describe("buildMapboxSearchBoxForwardUrl", () => {
  it("builds a Search Box forward URL with proximity", () => {
    const url = buildMapboxSearchBoxForwardUrl("Farah Foods", {
      accessToken: "test-token",
      proximity: { longitude: -80.5222, latitude: 43.4643 },
    });

    expect(url).toContain("search/searchbox/v1/forward");
    expect(url).toContain("q=Farah+Foods");
    expect(url).toContain("proximity=-80.5222%2C43.4643");
    expect(url).toContain("types=poi");
  });
});

describe("mapMapboxSearchBoxFeature", () => {
  it("maps a Search Box POI with a numbered street address", () => {
    const mapped = mapMapboxSearchBoxFeature(
      {
        geometry: { coordinates: [-80.53855306, 43.4717432] },
        properties: {
          name: "Farah Foods",
          mapbox_id: "abc123",
          feature_type: "poi",
          full_address: "University Shops Plaza, Waterloo, N2L 3E9, Canada",
          context: {
            place: { name: "Waterloo" },
            postcode: { name: "N2L 3E9" },
            address: {
              name: "University Shops Plaza",
              address_number: "170",
              street_name: "University Ave W",
            },
          },
          coordinates: {
            latitude: 43.4717432,
            longitude: -80.53855306,
          },
        },
      },
      { fallbackProvince: "ON" },
    );

    expect(mapped.name).toBe("Farah Foods");
    expect(mapped.addressLine1).toBe("170 University Avenue West");
    expect(mapped.city).toBe("Waterloo");
    expect(mapped.province).toBe("ON");
    expect(mapped.postalCode).toBe("N2L 3E9");
    expect(mapped.externalPlaceId).toBe("poi.abc123");
  });
});
