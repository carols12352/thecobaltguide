import { describe, expect, it } from "vitest";
import {
  FAR_PULLBACK_DISTANCE_METRES,
  getMapMovePhaseDurations,
  shouldUsePullbackMove,
} from "@/lib/map/place-animation";

describe("shouldUsePullbackMove", () => {
  it("uses direct move for nearby locations", () => {
    expect(shouldUsePullbackMove(100)).toBe(false);
    expect(shouldUsePullbackMove(FAR_PULLBACK_DISTANCE_METRES)).toBe(false);
  });

  it("uses pull-back move for far locations", () => {
    expect(shouldUsePullbackMove(FAR_PULLBACK_DISTANCE_METRES + 1)).toBe(true);
    expect(shouldUsePullbackMove(5_000)).toBe(true);
  });
});

describe("getMapMovePhaseDurations", () => {
  it("uses one fixed duration for nearby direct moves", () => {
    expect(getMapMovePhaseDurations(200)).toEqual({
      totalMs: 500,
      pullbackMs: 0,
      zoomInMs: 500,
    });
  });

  it("splits far moves into fixed pull-back and zoom-in phases", () => {
    expect(getMapMovePhaseDurations(5_000)).toEqual({
      totalMs: 1_000,
      pullbackMs: 450,
      zoomInMs: 550,
    });
  });

  it("uses the farthest fixed tier for very long moves", () => {
    expect(getMapMovePhaseDurations(200_000)).toEqual({
      totalMs: 3_000,
      pullbackMs: 1_350,
      zoomInMs: 1_650,
    });
  });
});
