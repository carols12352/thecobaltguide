import { describe, expect, it } from "vitest";
import { canShowAdminHeaderLink } from "@/lib/auth/header-navigation";

describe("admin header navigation", () => {
  it("shows the admin link only to active admins", () => {
    expect(
      canShowAdminHeaderLink({ role: "admin", status: "active" }),
    ).toBe(true);
    expect(
      canShowAdminHeaderLink({ role: "admin", status: "suspended" }),
    ).toBe(false);
    expect(
      canShowAdminHeaderLink({ role: "moderator", status: "active" }),
    ).toBe(false);
    expect(
      canShowAdminHeaderLink({ role: "user", status: "active" }),
    ).toBe(false);
    expect(canShowAdminHeaderLink(null)).toBe(false);
  });
});
