import { describe, expect, it } from "vitest";
import { analyzePasswordStrength } from "@/lib/auth/password-strength";

describe("password strength", () => {
  it("starts at zero when empty", () => {
    expect(analyzePasswordStrength("")).toEqual({
      progress: 0,
      level: "empty",
      typeCount: 0,
      meetsMinimum: false,
      hasLower: false,
      hasUpper: false,
      hasDigit: false,
      hasSymbol: false,
    });
  });

  it("scores length alone lower than mixed types", () => {
    const lengthOnly = analyzePasswordStrength("abcdefgh");
    const mixed = analyzePasswordStrength("abcDEF12");

    expect(lengthOnly.progress).toBeLessThan(mixed.progress);
    expect(lengthOnly.meetsMinimum).toBe(false);
    expect(mixed.meetsMinimum).toBe(true);
  });

  it("rewards more character types", () => {
    const twoTypes = analyzePasswordStrength("abcdef12");
    const fourTypes = analyzePasswordStrength("Abcd1234!");

    expect(fourTypes.progress).toBeGreaterThan(twoTypes.progress);
    expect(fourTypes.typeCount).toBe(4);
  });
});
