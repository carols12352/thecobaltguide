import { describe, expect, it } from "vitest";
import { POI_ICON_ALIASES, resolvePoiIconAlias } from "@/lib/map/poi-icon-fallback";

describe("resolvePoiIconAlias", () => {
  it("maps known missing POI classes to sprite icons", () => {
    expect(resolvePoiIconAlias("ferry_terminal")).toBe("ferry_11");
    expect(resolvePoiIconAlias("recycling")).toBe("waste_basket_11");
    expect(resolvePoiIconAlias("office")).toBe("building_11");
  });

  it("falls back to a generic dot icon", () => {
    expect(resolvePoiIconAlias("totally_unknown_poi")).toBe("dot_11");
  });

  it("covers common alias entries", () => {
    expect(Object.keys(POI_ICON_ALIASES).length).toBeGreaterThan(10);
  });
});
