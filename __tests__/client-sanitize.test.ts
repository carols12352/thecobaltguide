import { describe, expect, it } from "vitest";
import {
  sanitizeBrowserEvent,
  stripUrlQuery,
} from "@/lib/monitoring/client-sanitize";

describe("browser monitoring privacy", () => {
  it("removes query parameters from absolute and relative URLs", () => {
    expect(stripUrlQuery("https://example.com/map?q=coffee#result")).toBe(
      "https://example.com/map",
    );
    expect(stripUrlQuery("/api/places/search?q=coffee")).toBe(
      "/api/places/search",
    );
  });

  it("removes identity and request payload data", () => {
    const event = sanitizeBrowserEvent({
      user: { id: "user-id", email: "private@example.com" },
      request: {
        url: "https://example.com/account?password=secret",
        cookies: { session: "secret" },
        headers: { authorization: "secret" },
        data: { email: "private@example.com" },
      },
      breadcrumbs: [
        {
          data: {
            url: "/api/places/search?q=home",
            from: "/login?next=/account&email=private@example.com",
            email: "private@example.com",
            status: 200,
            nested: { authorization: "secret", label: "private@example.com" },
          },
        },
      ],
    });

    expect(event.user).toBeUndefined();
    expect(event.request).toMatchObject({ url: "https://example.com/account" });
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.headers).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.breadcrumbs?.[0]?.data).toEqual({
      url: "/api/places/search",
      from: "/login",
      status: 200,
      nested: { label: "[redacted-email]" },
    });
  });
});
