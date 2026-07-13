import { describe, expect, it } from "vitest";
import {
  buildGeocodeQueries,
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

describe("buildGeocodeQueries", () => {
  it("includes progressive fallbacks for typo-prone addresses", () => {
    const queries = buildGeocodeQueries({
      name: "Walmart Supercenter",
      addressLine1: "70 Bridge Port E",
      city: "Waterloo",
      province: "ON",
      postalCode: "N2L 0J9",
    });

    expect(queries[0]).toBe(
      "Walmart Supercenter, 70 Bridge Port E, Waterloo, ON, N2L 0J9, Canada",
    );
    expect(queries).toContain("70 bridgeport East, Waterloo, ON, Canada");
    expect(queries.indexOf("70 bridgeport East, Waterloo, ON, Canada")).toBeGreaterThan(0);
  });
});
