import { describe, expect, it } from "vitest";
import {
  LOCAL_MOVE_NO_ZOOM_OUT_METRES,
  shouldAvoidZoomOut,
} from "@/lib/map/place-animation";

describe("shouldAvoidZoomOut", () => {
  it("keeps local moves from zooming out", () => {
    expect(shouldAvoidZoomOut(100)).toBe(true);
    expect(shouldAvoidZoomOut(LOCAL_MOVE_NO_ZOOM_OUT_METRES)).toBe(true);
  });

  it("allows zoom-out arcs for far moves", () => {
    expect(shouldAvoidZoomOut(LOCAL_MOVE_NO_ZOOM_OUT_METRES + 1)).toBe(false);
    expect(shouldAvoidZoomOut(50_000)).toBe(false);
  });
});
