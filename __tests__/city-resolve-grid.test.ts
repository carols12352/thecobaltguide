import { describe, expect, it } from "vitest";
import { cityResolveGridKey } from "@/lib/map/city-resolve-grid";

describe("cityResolveGridKey", () => {
  it("snaps coordinates to a coarse grid", () => {
    expect(cityResolveGridKey(43.6532, -79.3832)).toBe("43.65:-79.4");
    expect(cityResolveGridKey(45.5017, -73.5673)).toBe("45.5:-73.55");
  });
});
