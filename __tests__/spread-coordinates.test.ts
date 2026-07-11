import { describe, expect, it } from "vitest";
import { spreadCoordinates } from "@/lib/map/spread-coordinates";

describe("spreadCoordinates", () => {
  const toronto = { latitude: 43.6535, longitude: -79.3839 };

  it("returns different coordinates for different seeds", () => {
    const a = spreadCoordinates(
      toronto.latitude,
      toronto.longitude,
      "rewards-canada:starbucks:toronto:on",
    );
    const b = spreadCoordinates(
      toronto.latitude,
      toronto.longitude,
      "rewards-canada:tim-hortons:toronto:on",
    );

    expect(a.latitude).not.toBe(b.latitude);
    expect(a.longitude).not.toBe(b.longitude);
  });

  it("is deterministic for the same seed", () => {
    const seed = "rewards-canada:test:toronto:on";
    const first = spreadCoordinates(
      toronto.latitude,
      toronto.longitude,
      seed,
    );
    const second = spreadCoordinates(
      toronto.latitude,
      toronto.longitude,
      seed,
    );

    expect(first).toEqual(second);
  });

  it("offsets stay within roughly 1.5 km of the base point", () => {
    const spread = spreadCoordinates(
      toronto.latitude,
      toronto.longitude,
      "rewards-canada:offset-test:toronto:on",
    );

    const latDiff = Math.abs(spread.latitude - toronto.latitude);
    const lngDiff = Math.abs(spread.longitude - toronto.longitude);

    expect(latDiff).toBeLessThan(0.02);
    expect(lngDiff).toBeLessThan(0.02);
    expect(latDiff + lngDiff).toBeGreaterThan(0);
  });
});
