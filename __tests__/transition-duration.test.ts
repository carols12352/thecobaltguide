import { describe, expect, it } from "vitest";
import { getTransitionDurationMs } from "@/lib/map/distance";

describe("getTransitionDurationMs", () => {
  it("uses 0.5s for nearby places", () => {
    expect(getTransitionDurationMs(500)).toBe(500);
    expect(getTransitionDurationMs(2_000)).toBe(500);
  });

  it("uses 1s for mid-range places", () => {
    expect(getTransitionDurationMs(2_001)).toBe(1_000);
    expect(getTransitionDurationMs(10_000)).toBe(1_000);
  });

  it("caps at 2s for far places", () => {
    expect(getTransitionDurationMs(10_001)).toBe(2_000);
    expect(getTransitionDurationMs(100_000)).toBe(2_000);
  });
});
