import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  getEmailCooldownRemainingMs,
  isEmailCooldownActive,
  startEmailCooldown,
} from "@/lib/auth/email-cooldown";

describe("email cooldown", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      clear: () => store.clear(),
    });
  });

  it("starts inactive for a fresh email", () => {
    expect(isEmailCooldownActive("user@example.com")).toBe(false);
  });

  it("activates after starting cooldown", () => {
    startEmailCooldown("user@example.com");
    expect(isEmailCooldownActive("user@example.com")).toBe(true);
    expect(getEmailCooldownRemainingMs("user@example.com")).toBeGreaterThan(0);
  });

  it("normalizes email casing", () => {
    startEmailCooldown("User@Example.com");
    expect(isEmailCooldownActive("user@example.com")).toBe(true);
  });
});
