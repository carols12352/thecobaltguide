import { afterEach, describe, expect, it, vi } from "vitest";
import { findGooglePlaceId } from "@/server/geocoding/google-places";

const input = {
  name: "Test Cafe",
  addressLine1: "100 Queen St W",
  city: "Toronto",
  province: "ON",
  postalCode: "M5H 2N2",
  countryCode: "CA",
  latitude: 43.653226,
  longitude: -79.383184,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google Places lookup", () => {
  it("returns an ID only when name, distance, and address evidence are strong", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              id: "ChIJ-test",
              displayName: { text: "Test Cafe" },
              formattedAddress: "100 Queen St W, Toronto, ON M5H 2N2, Canada",
              location: { latitude: 43.6533, longitude: -79.3832 },
              businessStatus: "OPERATIONAL",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(findGooglePlaceId(input, "secret-key")).resolves.toBe(
      "ChIJ-test",
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(init.headers).toMatchObject({
      "X-Goog-Api-Key": "secret-key",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus",
    });
    expect(JSON.parse(init.body)).toMatchObject({
      textQuery: "Test Cafe, 100 Queen St W, Toronto, ON, M5H 2N2, CA",
      pageSize: 1,
      regionCode: "ca",
      locationBias: {
        circle: {
          center: { latitude: 43.653226, longitude: -79.383184 },
          radius: 100,
        },
      },
    });
  });

  it("rejects a distant or differently named first result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            places: [
              {
                id: "ChIJ-wrong",
                displayName: { text: "Different Store" },
                formattedAddress: "100 Queen St W, Toronto, ON M5H 2N2, Canada",
                location: { latitude: 43.7, longitude: -79.4 },
                businessStatus: "OPERATIONAL",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(findGooglePlaceId(input, "secret-key")).resolves.toBeNull();
  });

  it("fails open when the API is unavailable or not configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(findGooglePlaceId(input, "secret-key")).resolves.toBeNull();
    await expect(findGooglePlaceId(input, "")).resolves.toBeNull();
  });
});
