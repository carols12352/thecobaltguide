import { describe, expect, it } from "vitest";
import {
  buildAddressGeocodeQueries,
  buildGeocodeQueries,
  buildGeocodeQueriesForTier,
  buildNameCityGeocodeQueries,
  buildPostalGeocodeQueries,
  dedupeGeocodeResults,
  looksLikeStreetAddress,
  looksLikeCityNameStreetNoise,
  mergeGeocodeResultsByTier,
  mergeSplitStreetName,
  normalizeAddressLine,
} from "@/lib/geocoding/address-query";

describe("normalizeAddressLine", () => {
  it("expands common street abbreviations", () => {
    expect(normalizeAddressLine("70 Bridgeport Rd E")).toBe(
      "70 Bridgeport Road East",
    );
  });
});

describe("mergeSplitStreetName", () => {
  it("merges a split street name between house number and direction", () => {
    expect(mergeSplitStreetName("70 Bridge Port E")).toBe("70 bridgeport East");
  });

  it("does not merge when a street suffix is present", () => {
    expect(mergeSplitStreetName("123 King St W")).toBeNull();
  });
});

describe("looksLikeStreetAddress", () => {
  it("treats numbered streets as addresses", () => {
    expect(looksLikeStreetAddress("665 King St W")).toBe(true);
  });

  it("treats merchant names as non-address lines", () => {
    expect(looksLikeStreetAddress("The Lancaster Smokehouse")).toBe(false);
  });

  it("does not treat a city name as a street address", () => {
    expect(looksLikeStreetAddress("Waterloo", { city: "Waterloo" })).toBe(false);
    expect(looksLikeStreetAddress("Kars", { city: "Kars" })).toBe(false);
  });

  it("still treats real streets as addresses when the city shares a token", () => {
    expect(
      looksLikeStreetAddress("Waterloo Street", { city: "Waterloo" }),
    ).toBe(true);
  });

  it("rejects city-name street corruption when the city field differs", () => {
    expect(
      looksLikeStreetAddress("Waterloo Street", { city: "Kars" }),
    ).toBe(false);
  });

  it("does not treat city + province labels as street addresses", () => {
    expect(looksLikeStreetAddress("Waterloo, ON", { city: "Waterloo" })).toBe(
      false,
    );
  });
});

describe("looksLikeCityNameStreetNoise", () => {
  it("flags streets named after the lookup city during POI search", () => {
    expect(looksLikeCityNameStreetNoise("Waterloo Street", "Waterloo")).toBe(
      true,
    );
    expect(looksLikeCityNameStreetNoise("665 King Street", "Waterloo")).toBe(
      false,
    );
  });
});

describe("buildAddressGeocodeQueries", () => {
  it("skips business-name lines", () => {
    expect(
      buildAddressGeocodeQueries({
        addressLine1: "The Lancaster Smokehouse",
        city: "Kitchener",
        province: "ON",
        postalCode: "N2K 1M3",
      }),
    ).toEqual([]);
  });
});

describe("buildPostalGeocodeQueries", () => {
  it("builds postal-first fallback queries", () => {
    expect(
      buildPostalGeocodeQueries({
        city: "Kitchener",
        province: "ON",
        postalCode: "N2K 1M3",
      }),
    ).toEqual(["N2K 1M3, Kitchener, ON, Canada", "N2K 1M3, Canada"]);
  });

  it("builds postal-only queries when city and province are missing", () => {
    expect(
      buildPostalGeocodeQueries({
        postalCode: "N2K 1M3",
      }),
    ).toEqual(["N2K 1M3, Canada"]);
  });
});

describe("buildNameCityGeocodeQueries", () => {
  it("omits postal code from merchant-name queries", () => {
    expect(
      buildNameCityGeocodeQueries({
        name: "The Lancaster Smokehouse",
        city: "Kitchener",
        province: "ON",
        postalCode: "N2K 1M3",
      }),
    ).toEqual([
      "The Lancaster Smokehouse, Kitchener, ON, Canada",
      "The Lancaster Smokehouse, Kitchener, Canada",
    ]);
  });
});

describe("buildGeocodeQueriesForTier", () => {
  it("returns tier-specific query builders", () => {
    const input = {
      name: "The Lancaster Smokehouse",
      addressLine1: "665 King St W",
      city: "Kitchener",
      province: "ON",
      postalCode: "N2K 1M3",
    };

    expect(buildGeocodeQueriesForTier("postal", input)).toEqual(
      buildPostalGeocodeQueries(input),
    );
    expect(buildGeocodeQueriesForTier("address", input)).toEqual(
      buildAddressGeocodeQueries(input),
    );
    expect(buildGeocodeQueriesForTier("name", input)).toEqual(
      buildNameCityGeocodeQueries(input),
    );
  });
});

describe("buildGeocodeQueries", () => {
  it("prioritizes postal code before street address and merchant name", () => {
    const queries = buildGeocodeQueries({
      name: "The Lancaster Smokehouse",
      addressLine1: "665 King St W",
      city: "Kitchener",
      province: "ON",
      postalCode: "N2K 1M3",
    });

    expect(queries[0]).toBe("N2K 1M3, Kitchener, ON, Canada");
    expect(queries).toContain("665 King St W, N2K 1M3, Kitchener, ON, Canada");
    expect(queries).toContain(
      "The Lancaster Smokehouse, Kitchener, ON, Canada",
    );
    expect(
      queries.indexOf("N2K 1M3, Kitchener, ON, Canada"),
    ).toBeLessThan(
      queries.indexOf("665 King St W, N2K 1M3, Kitchener, ON, Canada"),
    );
    expect(
      queries.indexOf("665 King St W, N2K 1M3, Kitchener, ON, Canada"),
    ).toBeLessThan(
      queries.indexOf("The Lancaster Smokehouse, Kitchener, ON, Canada"),
    );
  });
});

describe("mergeGeocodeResultsByTier", () => {
  const makeResult = (
    id: string,
    tier?: "postal" | "address" | "name",
  ) => ({
    name: id,
    addressLine1: id,
    city: "Kitchener",
    province: "ON",
    postalCode: "N2K 1M3",
    countryCode: "CA",
    latitude: 43.45,
    longitude: -80.49,
    externalPlaceId: id,
    matchTier: tier,
  });

  it("merges tiers in postal, address, then name order", () => {
    const merged = mergeGeocodeResultsByTier({
      postal: [makeResult("postal-1", "postal")],
      address: [makeResult("address-1", "address")],
      name: [makeResult("name-1", "name")],
    });

    expect(merged.map((result) => result.externalPlaceId)).toEqual([
      "postal-1",
      "address-1",
      "name-1",
    ]);
  });

  it("dedupes across tiers and caps totals", () => {
    const shared = makeResult("shared", "postal");
    const merged = mergeGeocodeResultsByTier(
      {
        postal: [shared, makeResult("postal-2", "postal")],
        address: [shared, makeResult("address-2", "address")],
        name: Array.from({ length: 6 }, (_, index) =>
          makeResult(`name-${index}`, "name"),
        ),
      },
      { maxPerTier: 5, maxTotal: 10 },
    );

    expect(merged).toHaveLength(8);
    expect(merged.filter((result) => result.externalPlaceId === "shared")).toHaveLength(
      1,
    );
    expect(merged[0]!.externalPlaceId).toBe("shared");
    expect(merged.at(-1)!.externalPlaceId).toBe("name-4");
  });
});

describe("dedupeGeocodeResults", () => {
  it("keeps the first occurrence of duplicate place ids", () => {
    const first = {
      name: "first",
      addressLine1: "first",
      city: "Kitchener",
      province: "ON",
      postalCode: "N2K 1M3",
      countryCode: "CA",
      latitude: 43.45,
      longitude: -80.49,
      externalPlaceId: "same-id",
    };
    const second = { ...first, name: "second" };

    expect(dedupeGeocodeResults([first, second])).toEqual([first]);
  });
});
