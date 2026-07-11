import { describe, expect, it } from "vitest";
import { formatPlaceAddress } from "@/lib/utils";

describe("formatPlaceAddress", () => {
  it("dedupes city from imported Rewards Canada address lines", () => {
    expect(
      formatPlaceAddress({
        name: "Chiang Rai Thai Kitchen and Bar",
        addressLine1: "Chiang Rai Thai Kitchen and Bar, Toronto",
        city: "Toronto",
        province: "ON",
        postalCode: "unknown",
      }),
    ).toBe("Chiang Rai Thai Kitchen and Bar, Toronto, ON");
  });

  it("omits placeholder postal codes", () => {
    expect(
      formatPlaceAddress({
        addressLine1: "123 King St W",
        city: "Toronto",
        province: "ON",
        postalCode: "M5H 1A1",
      }),
    ).toBe("123 King St W, Toronto, ON, M5H 1A1");
  });
});
