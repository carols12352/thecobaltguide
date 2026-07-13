import { describe, expect, it } from "vitest";
import {
  isValidCanadianPostalCode,
  formatCanadianPostalCodeInput,
  normalizeCanadianPostalCode,
} from "@/lib/validation/canadian-postal-code";
import { geocodeQuerySchema } from "@/server/validation/schemas";

describe("Canadian postal code", () => {
  it("accepts spaced and compact formats", () => {
    expect(isValidCanadianPostalCode("M5V 1A1")).toBe(true);
    expect(isValidCanadianPostalCode("m5v1a1")).toBe(true);
    expect(isValidCanadianPostalCode("N2J 2J9")).toBe(true);
    expect(isValidCanadianPostalCode("N2J2J9")).toBe(true);
  });

  it("rejects invalid letters and shapes", () => {
    expect(isValidCanadianPostalCode("D1A 1A1")).toBe(false);
    expect(isValidCanadianPostalCode("M5I 1A1")).toBe(false);
    expect(isValidCanadianPostalCode("12345")).toBe(false);
    expect(isValidCanadianPostalCode("M5V")).toBe(false);
    expect(isValidCanadianPostalCode("")).toBe(false);
  });

  it("normalizes to uppercase with a space", () => {
    expect(normalizeCanadianPostalCode("m5v1a1")).toBe("M5V 1A1");
    expect(normalizeCanadianPostalCode("N2J-2J9")).toBe("N2J 2J9");
  });
});

describe("formatCanadianPostalCodeInput", () => {
  it("builds the code position by position", () => {
    expect(formatCanadianPostalCodeInput("")).toBe("");
    expect(formatCanadianPostalCodeInput("n")).toBe("N");
    expect(formatCanadianPostalCodeInput("n2")).toBe("N2");
    expect(formatCanadianPostalCodeInput("n2j")).toBe("N2J");
    expect(formatCanadianPostalCodeInput("n2j2")).toBe("N2J 2");
    expect(formatCanadianPostalCodeInput("n2j2j9")).toBe("N2J 2J9");
    expect(formatCanadianPostalCodeInput("m5v1a1")).toBe("M5V 1A1");
  });

  it("rejects invalid characters at each position", () => {
    expect(formatCanadianPostalCodeInput("n2i")).toBe("N2");
    expect(formatCanadianPostalCodeInput("123456")).toBe("");
    expect(formatCanadianPostalCodeInput("!!!")).toBe("");
  });

  it("caps input at six postal characters", () => {
    expect(formatCanadianPostalCodeInput("M5V1A1123")).toBe("M5V 1A1");
  });
});

describe("geocodeQuerySchema", () => {
  it("requires a valid postal code", () => {
    const parsed = geocodeQuerySchema.safeParse({
      addressLine1: "70 Bridgeport Rd E",
      city: "Waterloo",
      province: "ON",
      postalCode: "N2J2J9",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.postalCode).toBe("N2J 2J9");
    }
  });

  it("allows postal-code-only lookup without city or province", () => {
    const parsed = geocodeQuerySchema.safeParse({
      postalCode: "M5V 1A1",
    });

    expect(parsed.success).toBe(true);
  });

  it("allows optional merchant name and street address hints", () => {
    const parsed = geocodeQuerySchema.safeParse({
      name: "Walmart Supercenter",
      addressLine1: "70 Bridgeport Rd E",
      city: "Waterloo",
      province: "ON",
      postalCode: "N2J 2J9",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects lookup without name, postal code, or address", () => {
    const parsed = geocodeQuerySchema.safeParse({
      city: "Waterloo",
      province: "ON",
    });

    expect(parsed.success).toBe(false);
  });

  it("allows merchant-name-only lookup", () => {
    const parsed = geocodeQuerySchema.safeParse({
      name: "Walmart Supercenter",
      city: "Waterloo",
      province: "ON",
    });

    expect(parsed.success).toBe(true);
  });

  it("allows address-only lookup without postal code", () => {
    const parsed = geocodeQuerySchema.safeParse({
      addressLine1: "70 Bridgeport Rd E",
      city: "Waterloo",
      province: "ON",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid postal codes", () => {
    const parsed = geocodeQuerySchema.safeParse({
      addressLine1: "70 Bridgeport Rd E",
      city: "Waterloo",
      province: "ON",
      postalCode: "123456",
    });

    expect(parsed.success).toBe(false);
  });
});
