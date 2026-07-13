import { describe, expect, it } from "vitest";
import {
  getPaginationMaxSlots,
  getPaginationRange,
  getPaginationSiblingCount,
} from "@/lib/pagination/page-range";

describe("getPaginationSiblingCount", () => {
  it("uses the maximum sibling count that fits in available width", () => {
    const page = 5;
    const total = 20;

    expect(getPaginationSiblingCount(200, page, total)).toBe(0);
    expect(getPaginationSiblingCount(280, page, total)).toBe(0);

    const slots360 = getPaginationMaxSlots(360);
    const sibling360 = getPaginationSiblingCount(360, page, total);
    expect(getPaginationRange(page, total, sibling360).length).toBeLessThanOrEqual(
      slots360,
    );
    expect(
      getPaginationRange(page, total, sibling360 + 1).length,
    ).toBeGreaterThan(slots360);

    const slots400 = getPaginationMaxSlots(400);
    const sibling400 = getPaginationSiblingCount(400, page, total);
    expect(getPaginationRange(page, total, sibling400).length).toBeLessThanOrEqual(
      slots400,
    );
  });

  it("shows all pages when total fits in the available width", () => {
    expect(getPaginationSiblingCount(700, 2, 5)).toBe(5);
    expect(getPaginationRange(2, 5, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("getPaginationRange", () => {
  it("returns all pages when total is small", () => {
    expect(getPaginationRange(2, 5, 2)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses distant pages with ellipses", () => {
    expect(getPaginationRange(5, 10, 1)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      10,
    ]);
  });

  it("shows first and last pages on the edges", () => {
    expect(getPaginationRange(1, 10, 1)).toEqual([1, 2, "ellipsis", 10]);
    expect(getPaginationRange(10, 10, 1)).toEqual([1, "ellipsis", 9, 10]);
  });
});
