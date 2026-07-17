import { expect, test } from "@playwright/test";

test("global responses include the configured browser security headers", async ({
  request,
}) => {
  // Use a static application asset so this deployment-level check stays
  // independent from Supabase sessions and the mutation fixtures.
  const response = await request.get("/icon.svg");

  expect(response.ok()).toBe(true);

  const headers = response.headers();
  expect(headers["content-security-policy-report-only"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["content-security-policy-report-only"]).toContain(
    "https://tiles.openfreemap.org",
  );
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["permissions-policy"]).toContain("geolocation=(self)");
});
