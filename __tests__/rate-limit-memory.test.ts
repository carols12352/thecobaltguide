import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEMORY_RATE_LIMIT_MAX_ENTRIES,
  checkRateLimitMemory,
  getMemoryRateLimitStoreSizeForTests,
  resetMemoryRateLimitStoreForTests,
} from "@/lib/rate-limit";

describe("in-memory rate limit fallback", () => {
  beforeEach(() => {
    resetMemoryRateLimitStoreForTests();
    vi.useRealTimers();
  });

  it("prunes expired windows opportunistically", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00Z"));
    checkRateLimitMemory("expired", 2, 1_000);

    vi.advanceTimersByTime(1_001);
    for (let index = 0; index < 64; index++) {
      checkRateLimitMemory(`fresh-${index}`, 2, 10_000);
    }

    expect(getMemoryRateLimitStoreSizeForTests()).toBe(64);
  });

  it("never grows beyond the configured cap", () => {
    for (let index = 0; index < MEMORY_RATE_LIMIT_MAX_ENTRIES + 5; index++) {
      checkRateLimitMemory(`key-${index}`, 1, 60_000);
    }

    expect(getMemoryRateLimitStoreSizeForTests()).toBe(
      MEMORY_RATE_LIMIT_MAX_ENTRIES,
    );
  });
});
