import { describe, expect, it, vi } from "vitest";
import { jsonRateLimited } from "@/lib/api/response";

describe("rate-limit response", () => {
  it("includes retry metadata and prevents caching", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00Z"));
    const response = jsonRateLimited(Date.now() + 30_000);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(response.headers.get("ratelimit-reset")).toBe(
      String(Math.ceil((Date.now() + 30_000) / 1000)),
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    vi.useRealTimers();
  });
});
