import { describe, expect, it } from "vitest";
import {
  filterBusinessGeocodeResults,
  filterGeocodeResultsForLookupContext,
  filterGeocodeResultsForPostalCode,
  isPoiGeocodeResult,
  mergeGeocodeIntoAddressFields,
  mergeGeocodeLookupIntoAddressFields,
  mergeReverseGeocodeIntoAddressFields,
  normalizeGeocodeResult,
  pickPreferredGeocodeResult,
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

  it("does not treat city names as street addresses", () => {
    expect(
      resolveGeocodeAddressLine1(
        sampleResult({
          name: "Waterloo",
          addressLine1: "",
          city: "Waterloo",
        }),
      ),
    ).toBeUndefined();
  });
});

describe("filterGeocodeResultsForLookupContext", () => {
  it("drops address-tier hits outside the lookup postal code", () => {
    const filtered = filterGeocodeResultsForLookupContext(
      [
        sampleResult({
          addressLine1: "Waterloo Street",
          city: "Kingston",
          postalCode: "K7M 8L2",
          externalPlaceId: "b",
        }),
        sampleResult({
          addressLine1: "123 Main Street",
          city: "Kars",
          postalCode: "K0A 2E0",
          externalPlaceId: "a",
        }),
      ],
      { postalCode: "K0A 2E0", city: "Kars" },
      { tier: "address" },
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.city).toBe("Kars");
  });

  it("keeps name-tier POI hits when city is only present in the label", () => {
    const filtered = filterGeocodeResultsForLookupContext(
      [
        sampleResult({
          name: "Farah Foods",
          addressLine1: "140 University Avenue West",
          city: "",
          externalPlaceId: "poi.1",
          geocodeLabel:
            "Farah Foods, 140 University Avenue West, Waterloo, Ontario, Canada",
        }),
      ],
      { city: "Waterloo" },
      { tier: "name" },
    );

    expect(filtered).toHaveLength(1);
  });

  it("filters out neighbouring cities for name-tier lookups", () => {
    const filtered = filterGeocodeResultsForLookupContext(
      [
        sampleResult({
          name: "Farah Foods",
          addressLine1: "242 King Street North",
          city: "Waterloo",
          externalPlaceId: "nominatim:1",
          geocodeLabel:
            "Farah Foods, 242 King Street North, Waterloo, Region of Waterloo, Ontario, Canada",
        }),
        sampleResult({
          name: "Farah Foods",
          addressLine1: "Heritage Drive",
          city: "Kitchener",
          externalPlaceId: "nominatim:2",
          geocodeLabel:
            "Farah Foods, Heritage Drive, Kitchener, Region of Waterloo, Ontario, Canada",
        }),
      ],
      { city: "Waterloo" },
      {
        tier: "name",
        cityCentroid: { latitude: 43.4643, longitude: -80.5222 },
      },
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.city).toBe("Waterloo");
  });
});

describe("filterBusinessGeocodeResults", () => {
  it("drops city-name streets but keeps POI matches", () => {
    const filtered = filterBusinessGeocodeResults(
      [
        sampleResult({
          name: "Waterloo Street",
          addressLine1: "Waterloo Street",
          city: "Waterloo",
          externalPlaceId: "address.1",
        }),
        sampleResult({
          name: "Farah Foods",
          addressLine1: "140 University Avenue West",
          city: "Waterloo",
          externalPlaceId: "poi.1",
        }),
      ],
      { name: "Farah Foods", city: "Waterloo" },
    );

    expect(filtered).toHaveLength(1);
    expect(isPoiGeocodeResult(filtered[0]!)).toBe(true);
    expect(filtered[0]!.name).toBe("Farah Foods");
  });
});

describe("pickPreferredGeocodeResult", () => {
  it("prefers a POI in the requested city for merchant name lookups", () => {
    const preferred = pickPreferredGeocodeResult(
      [
        sampleResult({
          name: "Waterloo Street",
          addressLine1: "Waterloo Street",
          city: "Kars",
          postalCode: "K0A 2E0",
          matchTier: "postal",
          externalPlaceId: "address.postal",
        }),
        sampleResult({
          name: "Farah Foods",
          addressLine1: "140 University Avenue West",
          city: "Waterloo",
          matchTier: "name",
          externalPlaceId: "poi.1",
        }),
      ],
      { name: "Farah Foods", city: "Waterloo" },
    );

    expect(preferred?.name).toBe("Farah Foods");
    expect(preferred?.externalPlaceId).toBe("poi.1");
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

  it("fills empty fields and fixes invalid postal codes", () => {
    const merged = mergeGeocodeIntoAddressFields(
      {
        addressLine1: "",
        city: "",
        province: "",
        postalCode: "N2K",
        latitude: 0,
        longitude: 0,
      },
      sampleResult(),
    );

    expect(merged.addressLine1).toBe("665 King Street West");
    expect(merged.city).toBe("Kitchener");
    expect(merged.province).toBe("ON");
    expect(merged.postalCode).toBe("N2K 1M3");
  });

  it("corrects city when postal matches but city was wrong", () => {
    const merged = mergeGeocodeIntoAddressFields(
      {
        addressLine1: "665 King Street West",
        city: "Toronto",
        province: "ON",
        postalCode: "N2K 1M3",
        latitude: 0,
        longitude: 0,
      },
      sampleResult(),
    );

    expect(merged.city).toBe("Kitchener");
    expect(merged.addressLine1).toBe("665 King Street West");
  });

  it("keeps a valid street address when geocoder returns another street", () => {
    const merged = mergeGeocodeIntoAddressFields(
      {
        addressLine1: "100 Main Street",
        city: "Kitchener",
        province: "ON",
        postalCode: "N2K 1M3",
        latitude: 0,
        longitude: 0,
      },
      sampleResult({ addressLine1: "665 King Street West" }),
    );

    expect(merged.addressLine1).toBe("100 Main Street");
  });
});

describe("mergeGeocodeLookupIntoAddressFields", () => {
  it("backfills wrong fields after an explicit postal lookup", () => {
    const merged = mergeGeocodeLookupIntoAddressFields(
      {
        addressLine1: "The Lancaster Smokehouse",
        city: "Toronto",
        province: "ON",
        postalCode: "K6A 2P2",
        latitude: 0,
        longitude: 0,
      },
      sampleResult(),
      { postalCode: "N2K 1M3" },
    );

    expect(merged.addressLine1).toBe("665 King Street West");
    expect(merged.city).toBe("Kitchener");
    expect(merged.province).toBe("ON");
    expect(merged.postalCode).toBe("N2K 1M3");
    expect(merged.latitude).toBe(43.45);
  });

  it("backfills empty fields after a name lookup", () => {
    const merged = mergeGeocodeLookupIntoAddressFields(
      {
        addressLine1: "",
        city: "",
        province: "",
        postalCode: "",
        latitude: 0,
        longitude: 0,
      },
      sampleResult(),
      { name: "The Lancaster Smokehouse" },
    );

    expect(merged.addressLine1).toBe("665 King Street West");
    expect(merged.city).toBe("Kitchener");
    expect(merged.province).toBe("ON");
    expect(merged.postalCode).toBe("N2K 1M3");
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
