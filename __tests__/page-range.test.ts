import { describe, expect, it } from "vitest";
import {
  getPaginationRange,
  getPaginationSiblingCount,
} from "@/lib/pagination/page-range";

describe("getPaginationSiblingCount", () => {
  it("returns fewer siblings on narrow viewports", () => {
    expect(getPaginationSiblingCount(400)).toBe(0);
    expect(getPaginationSiblingCount(700)).toBe(2);
    expect(getPaginationSiblingCount(1300)).toBe(4);
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
