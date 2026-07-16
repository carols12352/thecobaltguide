import { describe, expect, it } from "vitest";
import {
  reviewedPlaceDisposition,
  rewardsCanadaDisplayName,
} from "@/lib/import/rewards-canada-reviewed";

describe("reviewed Rewards Canada seed", () => {
  it("removes source qualifiers from public display names", () => {
    expect(rewardsCanadaDisplayName("Tim Hortons (including app reloads)"))
      .toBe("Tim Hortons");
    expect(rewardsCanadaDisplayName("Safeway (Gas stations & Liquor Stores included)"))
      .toBe("Safeway");
    expect(rewardsCanadaDisplayName("Plaza Grocery  1864 Albemarle St"))
      .toBe("Plaza Grocery");
  });

  it("moves RBC Insurance out of physical map places", () => {
    expect(reviewedPlaceDisposition({ name: "RBC Insurance (Aviva)" })).toBe("online");
  });

  it("rejects address-specific sources matched to another address", () => {
    expect(reviewedPlaceDisposition({ name: "Needs 99 Morton Ave" })).toBe("exclude");
  });

  it("keeps valid branded branches and excludes polluted brand tags", () => {
    expect(reviewedPlaceDisposition({
      name: "Tim Hortons (including app reloads)",
      match: { basis: "brand", osm_name: "Tim Hortons Airport" },
    })).toBe("physical");
    expect(reviewedPlaceDisposition({
      name: "Tim Hortons (including app reloads)",
      match: { basis: "brand", osm_name: "London Health Sciences Centre" },
    })).toBe("exclude");
    expect(reviewedPlaceDisposition({
      name: "Tim Hortons (including app reloads)",
      match: { basis: "brand", osm_name: "Tim Horton Children's Camp" },
    })).toBe("exclude");
    expect(reviewedPlaceDisposition({
      name: "Safeway (Gas stations & Liquor Stores included)",
      match: { basis: "brand", osm_name: "Safeway Head Office" },
    })).toBe("exclude");
    expect(reviewedPlaceDisposition({
      name: "Pizza Hut",
      match: { basis: "brand", osm_name: "Pizza Salvatoré Lachute" },
    })).toBe("exclude");
    expect(reviewedPlaceDisposition({
      name: "East Side Marios",
      match: { basis: "brand", osm_name: "Fionn MacCool's" },
    })).toBe("exclude");
    expect(reviewedPlaceDisposition({
      name: "Gong Cha",
      match: { basis: "brand", osm_name: "Cha House" },
    })).toBe("exclude");
    expect(reviewedPlaceDisposition({
      name: "Husky",
      match: { basis: "brand", osm_name: "Chevron" },
    })).toBe("exclude");
    expect(reviewedPlaceDisposition({
      name: "Esso",
      match: { basis: "brand", osm_name: "Petro-Canada" },
    })).toBe("exclude");
    expect(reviewedPlaceDisposition({
      name: "Fido",
      match: { basis: "brand", osm_name: "Rogers" },
    })).toBe("exclude");
    expect(reviewedPlaceDisposition({
      name: "Shell",
      match: { basis: "brand", osm_name: "Flying J" },
    })).toBe("exclude");
    expect(reviewedPlaceDisposition({
      name: "Esso",
      match: { basis: "brand", osm_name: "Circle K" },
    })).toBe("physical");
    expect(reviewedPlaceDisposition({
      name: "Rexall",
      match: { basis: "brand", osm_name: "Swan Lake Laundry & Cleaners" },
    })).toBe("exclude");
  });
});
