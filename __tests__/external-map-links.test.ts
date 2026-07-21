import { describe, expect, it } from "vitest";
import {
  buildExternalMapLinks,
  buildExternalMapUrl,
} from "@/lib/map/external-map-links";

const destination = {
  latitude: 43.653226,
  longitude: -79.383184,
  label: "Sicheng's Café & Market #1, 多伦多",
};

describe("external map links", () => {
  it("builds a Google Maps destination from the merchant name and address", () => {
    const value = buildExternalMapUrl("google", {
      ...destination,
      addressLine1: "100 Queen St W",
      city: "Toronto",
      province: "ON",
      postalCode: "M5H 2N2",
    });
    const url = new URL(value!);

    expect(url.origin + url.pathname).toBe(
      "https://www.google.com/maps/search/",
    );
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe(
      "Sicheng's Café & Market #1, 多伦多, 100 Queen St W, Toronto, ON, M5H 2N2",
    );
    expect(url.searchParams.has("query_place_id")).toBe(false);
  });

  it("uses coordinates plus a Google Place ID to lock onto one listing", () => {
    const value = buildExternalMapUrl("google", {
      ...destination,
      googlePlaceId: "ChIJ-test-place-id",
    });
    const url = new URL(value!);

    expect(url.searchParams.get("query")).toBe("43.653226,-79.383184");
    expect(url.searchParams.get("query_place_id")).toBe("ChIJ-test-place-id");
  });

  it("falls back to coordinates when merchant context is unavailable", () => {
    const value = buildExternalMapUrl("google", {
      latitude: 43.65,
      longitude: -79.38,
    });
    expect(new URL(value!).searchParams.get("query")).toBe(
      "43.650000,-79.380000",
    );
  });

  it("builds an encoded Apple Maps pin with the merchant label", () => {
    const value = buildExternalMapUrl("apple", destination);
    const url = new URL(value!);

    expect(url.origin + url.pathname).toBe("https://maps.apple.com/");
    expect(url.searchParams.get("ll")).toBe("43.653226,-79.383184");
    expect(url.searchParams.get("q")).toBe(destination.label);
    expect(value).toContain("%26");
    expect(value).toContain("%23");
  });

  it.each([
    { latitude: Number.NaN, longitude: -79.38 },
    { latitude: 91, longitude: -79.38 },
    { latitude: 43.65, longitude: -181 },
    { latitude: undefined, longitude: -79.38 },
  ])("does not expose links for invalid coordinates", (coordinates) => {
    expect(buildExternalMapLinks(coordinates)).toEqual([]);
  });

  it("returns all supported providers in a stable order", () => {
    expect(buildExternalMapLinks(destination).map((link) => link.provider)).toEqual([
      "google",
      "apple",
    ]);
  });
});
