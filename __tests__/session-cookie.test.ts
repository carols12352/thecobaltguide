import { describe, expect, it } from "vitest";
import { hasSupabaseAuthCookie } from "@/lib/auth/session-cookie";

describe("Supabase session cookie detection", () => {
  it("skips anonymous and unrelated cookies", () => {
    expect(hasSupabaseAuthCookie([])).toBe(false);
    expect(hasSupabaseAuthCookie([{ name: "theme" }])).toBe(false);
  });

  it("detects normal and chunked Supabase auth cookies", () => {
    expect(
      hasSupabaseAuthCookie([{ name: "sb-project-auth-token" }]),
    ).toBe(true);
    expect(
      hasSupabaseAuthCookie([{ name: "sb-project-auth-token.0" }]),
    ).toBe(true);
  });
});
