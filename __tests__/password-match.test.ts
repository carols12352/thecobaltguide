import { describe, expect, it } from "vitest";
import {
  analyzeConfirmOverlay,
  analyzePasswordMatch,
  analyzePasswordOverlay,
  formatPasswordMatchHint,
  formatPasswordOverlayHint,
  passwordInputRingClass,
} from "@/lib/auth/password-match";

describe("password match", () => {
  it("returns empty analysis before confirm input", () => {
    expect(analyzePasswordMatch("secret12", "")).toEqual({
      segments: [],
      matchedCount: 0,
      mismatchCount: 0,
      isCompleteMatch: false,
    });
  });

  it("marks matching prefixes and mismatches", () => {
    expect(analyzePasswordMatch("abcdefgh", "abcxefgh").segments).toEqual([
      "match",
      "match",
      "match",
      "mismatch",
      "match",
      "match",
      "match",
      "match",
    ]);
  });

  it("detects complete match", () => {
    expect(analyzePasswordMatch("abcdefgh", "abcdefgh").isCompleteMatch).toBe(
      true,
    );
  });

  it("formats mismatch hints with character index", () => {
    expect(formatPasswordMatchHint(analyzePasswordMatch("abc", "abd"))).toContain(
      "Character 3",
    );
  });

  it("builds overlay segments on the original password field", () => {
    expect(analyzePasswordOverlay("abcdefgh", "abcxef").segments).toEqual([
      "match",
      "match",
      "match",
      "mismatch",
      "match",
      "match",
      "pending",
      "pending",
    ]);
  });

  it("marks extra confirm characters as amber segments", () => {
    expect(analyzeConfirmOverlay("abc", "abcdef").segments).toEqual([
      "match",
      "match",
      "match",
      "extra",
      "extra",
      "extra",
    ]);
  });

  it("formats overlay hints from password perspective", () => {
    expect(
      formatPasswordOverlayHint(analyzePasswordOverlay("abcdefgh", "abcxef")),
    ).toContain("Character 4");
  });

  it("styles password input as red when overlay has mismatches", () => {
    expect(passwordInputRingClass("abc", "abd", "password")).toContain("red");
  });
});
