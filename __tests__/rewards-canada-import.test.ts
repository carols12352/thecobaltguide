import { describe, expect, it } from "vitest";
import {
  buildExternalPlaceId,
  confidenceForImport,
  isCanadaWide,
  isNonMappableLocation,
  isRewardsCanadaImported,
  parseMultiplier,
  parseRewardsCanadaRecord,
  provinceToCode,
} from "@/lib/import/rewards-canada";

describe("rewards-canada import", () => {
  it("skips canada-wide entries", () => {
    expect(
      isNonMappableLocation({
        Merchant: "7-Eleven",
        City: "* Canada Wide",
        Province: "* Canada Wide",
        Points: 5,
      }),
    ).toBe(true);
    expect(isCanadaWide).toBeDefined();
  });

  it("skips province-wide entries", () => {
    expect(
      isNonMappableLocation({
        Merchant: "Ajisen Ramen",
        City: "* Province Wide",
        Province: "Ontario",
        Points: 5,
      }),
    ).toBe(true);
  });

  it("parses province names", () => {
    expect(provinceToCode("Ontario")).toBe("ON");
    expect(provinceToCode("British Columbia")).toBe("BC");
  });

  it("parses valid records", () => {
    const parsed = parseRewardsCanadaRecord({
      Merchant: "Dim Sum King Seafood Restaurant",
      City: "Toronto",
      Province: "Ontario",
      Points: 5,
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.multiplier).toBe(5);
    expect(parsed?.provinceCode).toBe("ON");
    expect(parsed?.externalPlaceId).toContain("rewards-canada:");
  });

  it("rejects invalid multipliers", () => {
    expect(parseMultiplier("")).toBeNull();
    expect(parseMultiplier(4)).toBeNull();
  });

  it("builds stable external ids", () => {
    const a = buildExternalPlaceId("Metro", "Toronto", "ON");
    const b = buildExternalPlaceId("Metro", "Toronto", "ON");
    expect(a).toBe(b);
    expect(isRewardsCanadaImported(a)).toBe(true);
  });

  it("uses high confidence for imported seed data", () => {
    expect(confidenceForImport(5)).toBe("high");
    expect(confidenceForImport(1)).toBe("high");
  });
});
