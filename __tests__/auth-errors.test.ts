import { describe, expect, it } from "vitest";
import { formatAuthError } from "@/lib/auth/errors";

describe("formatAuthError", () => {
  it("detects existing account on sign up", () => {
    expect(
      formatAuthError({ message: "User already registered" }),
    ).toContain("already exists");
  });

  it("suggests Google for invalid credentials", () => {
    expect(
      formatAuthError({ message: "Invalid login credentials" }),
    ).toContain("Google");
  });

  it("handles email not confirmed", () => {
    expect(formatAuthError({ message: "Email not confirmed" })).toContain(
      "confirm",
    );
  });
});
