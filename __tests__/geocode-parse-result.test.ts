import { describe, expect, it } from "vitest";
import {
  filterGeocodeResultsForPostalCode,
  mergeGeocodeIntoAddressFields,
  mergeReverseGeocodeIntoAddressFields,
  normalizeGeocodeResult,
  postalCodesEqual,
  rankGeocodeResults,
  resolveGeocodeAddressLine1,
} from "@/lib/geocoding/parse-result";
import type { GeocodingResult } from "@/types/domain";

const sampleResult = (overrides: Partial<GeocodingResult> = {}): GeocodingResult => ({
  name: "665 King Street West",
  addressLine1: "665 King Street West",
  city: "Kitchener",
  province: "ON",
  postalCode: "N2K 1M3",
  countryCode: "CA",
  latitude: 43.45,
  longitude: -80.46,
  externalPlaceId: "address.1",
  ...overrides,
});

describe("resolveGeocodeAddressLine1", () => {
  it("returns street addresses from geocoder results", () => {
    expect(resolveGeocodeAddressLine1(sampleResult())).toBe(
      "665 King Street West",
    );
  });

  it("does not treat postal codes as street addresses", () => {
    expect(
      resolveGeocodeAddressLine1(
        sampleResult({
          name: "N2K 1M3",
          addressLine1: "N2K 1M3",
        }),
      ),
    ).toBeUndefined();
  });
});

describe("filterGeocodeResultsForPostalCode", () => {
  it("keeps only results matching the lookup postal code", () => {
    const filtered = filterGeocodeResultsForPostalCode(
      [
        sampleResult({ postalCode: "N2K 1M3", externalPlaceId: "a" }),
        sampleResult({ postalCode: "K6A 2P2", externalPlaceId: "b" }),
      ],
      "N2K1M3",
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.postalCode).toBe("N2K 1M3");
  });
});

describe("mergeGeocodeIntoAddressFields", () => {
  it("fills street address from lookup results instead of postal code", () => {
    const merged = mergeGeocodeIntoAddressFields(
      {
        addressLine1: "The Lancaster Smokehouse",
        city: "Kitchener",
        province: "ON",
        postalCode: "N2K 1M3",
        latitude: 0,
        longitude: 0,
      },
      sampleResult(),
    );

    expect(merged.addressLine1).toBe("665 King Street West");
    expect(merged.postalCode).toBe("N2K 1M3");
  });

  it("does not copy business names from geocoder into address line 1", () => {
    const merged = mergeGeocodeIntoAddressFields(
      {
        addressLine1: "The Lancaster Smokehouse",
        city: "Kitchener",
        province: "ON",
        postalCode: "N2K 1M3",
        latitude: 0,
        longitude: 0,
      },
      sampleResult({
        name: "The Lancaster Smokehouse",
        addressLine1: "",
      }),
    );

    expect(merged.addressLine1).toBe("");
    expect(merged.latitude).toBe(43.45);
  });

  it("does not overwrite the lookup postal code with a different result postal", () => {
    const merged = mergeGeocodeIntoAddressFields(
      {
        addressLine1: "",
        city: "",
        province: "ON",
        postalCode: "N2K 1M3",
        latitude: 0,
        longitude: 0,
      },
      sampleResult({
        addressLine1: "Kitchener Street",
        city: "Hawkesbury",
        postalCode: "K6A 2P2",
      }),
    );

    expect(merged.postalCode).toBe("N2K 1M3");
    expect(merged.city).toBe("Hawkesbury");
  });
});

describe("mergeReverseGeocodeIntoAddressFields", () => {
  it("updates address fields but keeps the dragged pin coordinates", () => {
    const merged = mergeReverseGeocodeIntoAddressFields(
      {
        addressLine1: "",
        city: "Kitchener",
        province: "ON",
        postalCode: "N2K 1M3",
        latitude: 43.451,
        longitude: -80.461,
      },
      sampleResult({
        latitude: 43.449,
        longitude: -80.459,
      }),
    );

    expect(merged.addressLine1).toBe("665 King Street West");
    expect(merged.latitude).toBe(43.451);
    expect(merged.longitude).toBe(-80.461);
  });
});

describe("rankGeocodeResults", () => {
  it("prefers street addresses over postal-code centroids", () => {
    const ranked = rankGeocodeResults([
      sampleResult({ name: "N2K 1M3", addressLine1: "N2K 1M3", externalPlaceId: "postcode.1" }),
      sampleResult({ externalPlaceId: "address.2" }),
    ]);

    expect(normalizeGeocodeResult(ranked[0]!).addressLine1).toBe(
      "665 King Street West",
    );
  });

  it("prefers results matching the target postal code", () => {
    expect(postalCodesEqual("N2K1M3", "N2K 1M3")).toBe(true);

    const ranked = rankGeocodeResults(
      [
        sampleResult({ postalCode: "K6A 2P2", externalPlaceId: "wrong" }),
        sampleResult({ postalCode: "N2K 1M3", externalPlaceId: "right" }),
      ],
      { targetPostalCode: "N2K 1M3" },
    );

    expect(ranked[0]!.postalCode).toBe("N2K 1M3");
  });
});
