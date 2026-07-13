export type PaginationItem = number | "ellipsis";

/** Approximate pagination control widths in px (matches Tailwind min-w-9 / w-9). */
const PAGE_BUTTON_WIDTH = 36;
const EDGE_BUTTON_WIDTH = 36;
const NAV_INNER_CHROME = 16;

export function countPaginationSlots(items: PaginationItem[]): number {
  return items.length;
}

/** Max page-button slots that fit in the given width. */
export function getPaginationMaxSlots(availableWidth: number): number {
  const fixedWidth = EDGE_BUTTON_WIDTH * 2 + NAV_INNER_CHROME;
  return Math.floor(
    Math.max(0, availableWidth - fixedWidth) / PAGE_BUTTON_WIDTH,
  );
}

/** Use as many page slots as fit for the current page and total. */
export function getPaginationSiblingCount(
  availableWidth: number,
  currentPage: number,
  totalPages: number,
): number {
  if (totalPages <= 1) return 0;

  const maxSlots = getPaginationMaxSlots(availableWidth);
  if (maxSlots <= 1) return 0;

  if (
    countPaginationSlots(getPaginationRange(currentPage, totalPages, totalPages)) <=
    maxSlots
  ) {
    return totalPages;
  }

  let lo = 0;
  let hi = totalPages;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const slots = countPaginationSlots(
      getPaginationRange(currentPage, totalPages, mid),
    );
    if (slots <= maxSlots) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

export function getPaginationRange(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): PaginationItem[] {
  if (totalPages < 1) return [];
  if (totalPages === 1) return [1];

  const left = Math.max(2, currentPage - siblingCount);
  const right = Math.min(totalPages - 1, currentPage + siblingCount);
  const pages: PaginationItem[] = [1];

  if (left > 2) {
    pages.push("ellipsis");
  } else {
    for (let page = 2; page < left; page += 1) {
      pages.push(page);
    }
  }

  for (let page = left; page <= right; page += 1) {
    pages.push(page);
  }

  if (right < totalPages - 1) {
    pages.push("ellipsis");
  } else {
    for (let page = right + 1; page < totalPages; page += 1) {
      pages.push(page);
    }
  }

  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}
