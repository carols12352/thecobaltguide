export type PaginationItem = number | "ellipsis";

export function getPaginationSiblingCount(viewportWidth: number): number {
  if (viewportWidth < 480) return 0;
  if (viewportWidth < 640) return 1;
  if (viewportWidth < 900) return 2;
  if (viewportWidth < 1200) return 3;
  return 4;
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
