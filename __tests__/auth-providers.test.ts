import { describe, expect, it } from "vitest";
import {
  formatAccountExistsMessage,
  formatProviderLabel,
  formatProviderList,
  getSecurityStateFromUser,
  userHasEmailPassword,
  userHasPasswordLogin,
} from "@/lib/auth/providers";

describe("auth providers", () => {
  it("formats provider labels", () => {
    expect(formatProviderLabel("google")).toBe("Google");
    expect(formatProviderLabel("email")).toBe("Email and password");
  });

  it("formats provider lists", () => {
    expect(formatProviderList(["google", "email"])).toBe(
      "Google or Email and password",
    );
  });

  it("builds account exists message with last provider", () => {
    expect(
      formatAccountExistsMessage(["google", "email"], "google"),
    ).toContain("You last signed in with Google");
  });

  it("detects email password provider", () => {
    expect(userHasEmailPassword(["google"])).toBe(false);
    expect(userHasEmailPassword(["google", "email"])).toBe(true);
  });

  it("derives security state from session user", () => {
    expect(
      getSecurityStateFromUser({
        identities: [{ provider: "google" }],
        user_metadata: { has_password: true },
      }),
    ).toEqual({
      providers: ["google"],
      hasPasswordLogin: true,
    });
  });
});
