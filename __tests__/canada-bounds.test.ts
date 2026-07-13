import { describe, expect, it } from "vitest";
import { isInCanada } from "@/lib/map/canada-bounds";

describe("isInCanada", () => {
  it("returns true for major Canadian cities", () => {
    expect(isInCanada(43.6532, -79.3832)).toBe(true);
    expect(isInCanada(45.5017, -73.5673)).toBe(true);
    expect(isInCanada(49.2827, -123.1207)).toBe(true);
  });

  it("returns false outside Canada", () => {
    expect(isInCanada(40.7128, -74.006)).toBe(false);
    expect(isInCanada(-44.147, -74.574)).toBe(false);
  });
});
