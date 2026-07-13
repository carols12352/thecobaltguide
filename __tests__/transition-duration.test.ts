import { describe, expect, it } from "vitest";
import { getTransitionDurationMs } from "@/lib/map/distance";

describe("getTransitionDurationMs", () => {
  it("uses fixed tiers for nearby moves", () => {
    expect(getTransitionDurationMs(100)).toBe(500);
    expect(getTransitionDurationMs(500)).toBe(500);
  });

  it("steps up duration for mid-range moves", () => {
    expect(getTransitionDurationMs(501)).toBe(700);
    expect(getTransitionDurationMs(2_000)).toBe(700);
    expect(getTransitionDurationMs(2_001)).toBe(1_000);
    expect(getTransitionDurationMs(10_000)).toBe(1_000);
  });

  it("caps far moves at fixed tier durations", () => {
    expect(getTransitionDurationMs(10_001)).toBe(1_400);
    expect(getTransitionDurationMs(50_000)).toBe(1_400);
    expect(getTransitionDurationMs(100_000)).toBe(3_000);
    expect(getTransitionDurationMs(1_000_000)).toBe(3_000);
  });
});
