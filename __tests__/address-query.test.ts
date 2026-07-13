import { describe, expect, it } from "vitest";
import {
  buildAddressGeocodeQueries,
  buildGeocodeQueries,
  buildPostalGeocodeQueries,
  looksLikeStreetAddress,
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

describe("buildGeocodeQueries", () => {
  it("prioritizes street address before postal fallback", () => {
    const queries = buildGeocodeQueries({
      addressLine1: "665 King St W",
      city: "Kitchener",
      province: "ON",
      postalCode: "N2K 1M3",
    });

    expect(queries[0]).toBe("665 King St W, N2K 1M3, Kitchener, ON, Canada");
    expect(queries).toContain("N2K 1M3, Kitchener, ON, Canada");
  });
});
