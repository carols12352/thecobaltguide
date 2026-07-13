import { describe, expect, it } from "vitest";
import {
  parsePlaceSearchInput,
  PLACE_SEARCH_REQUIRED_MESSAGE,
} from "@/lib/admin/place-search";

describe("parsePlaceSearchInput", () => {
  it("requires at least one search field", () => {
    expect(
      parsePlaceSearchInput({ name: "", postalCode: "", addressLine1: "" }),
    ).toEqual({
      criteria: null,
      error: PLACE_SEARCH_REQUIRED_MESSAGE,
    });
  });

  it("accepts name, postal code, or address alone or combined", () => {
    expect(
      parsePlaceSearchInput({
        name: "Tim Hortons",
        postalCode: "",
        addressLine1: "",
      }),
    ).toEqual({
      criteria: { name: "Tim Hortons" },
      error: null,
    });

    expect(
      parsePlaceSearchInput({
        name: "",
        postalCode: "N2K 1M3",
        addressLine1: "",
      }),
    ).toEqual({
      criteria: { postalCode: "N2K 1M3" },
      error: null,
    });

    expect(
      parsePlaceSearchInput({
        name: "Shop",
        postalCode: "N2K 1M3",
        addressLine1: "123 King St",
      }),
    ).toEqual({
      criteria: {
        name: "Shop",
        postalCode: "N2K 1M3",
        addressLine1: "123 King St",
      },
      error: null,
    });
  });

  it("treats a lone UUID as a place id lookup", () => {
    const placeId = "12345678-1234-1234-1234-123456789abc";

    expect(
      parsePlaceSearchInput({
        name: placeId,
        postalCode: "",
        addressLine1: "",
      }),
    ).toEqual({
      criteria: { placeId },
      error: null,
    });
  });
});
