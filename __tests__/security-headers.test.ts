import { describe, expect, it } from "vitest";
import { getApplicationSecurityHeaders } from "@/lib/security/headers";

describe("application security headers", () => {
  it("applies browser hardening and a report-only CSP", () => {
    const headers = Object.fromEntries(
      getApplicationSecurityHeaders(false).map(({ key, value }) => [key, value]),
    );

    expect(headers["Content-Security-Policy-Report-Only"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("adds HSTS only for production", () => {
    const headers = Object.fromEntries(
      getApplicationSecurityHeaders(true).map(({ key, value }) => [key, value]),
    );
    expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
  });
});
