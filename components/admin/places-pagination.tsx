"use client";

import type { ComponentProps } from "react";
import { PaginationBar } from "@/components/ui/pagination-bar";

const PLACES_PAGE_SIZE = 10;

export function PlacesPagination(
  props: Omit<ComponentProps<typeof PaginationBar>, "pageSize" | "itemLabel">,
) {
  return (
    <PaginationBar
      {...props}
      pageSize={PLACES_PAGE_SIZE}
      itemLabel="places"
    />
  );
}

export { PLACES_PAGE_SIZE };
