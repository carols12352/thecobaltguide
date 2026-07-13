"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useViewportWidth } from "@/lib/hooks/use-viewport-width";
import { cn } from "@/lib/utils";
import {
  getPaginationRange,
  getPaginationSiblingCount,
} from "@/lib/pagination/page-range";

export interface PaginationBarProps {
  page: number;
  total: number;
  pageSize?: number;
  itemLabel?: string;
  loading?: boolean;
  compact?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d={direction === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PaginationBar({
  page,
  total,
  pageSize = 10,
  itemLabel = "results",
  loading = false,
  compact = false,
  onPageChange,
  className,
}: PaginationBarProps) {
  const jumpInputId = useId();
  const viewportWidth = useViewportWidth();
  const [jumpValue, setJumpValue] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const siblingCount = getPaginationSiblingCount(viewportWidth);
  const pages = useMemo(
    () => getPaginationRange(page, totalPages, siblingCount),
    [page, siblingCount, totalPages],
  );

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const canGoBack = page > 1 && !loading;
  const canGoForward = page < totalPages && !loading;

  function submitJump(e: React.FormEvent) {
    e.preventDefault();
    const nextPage = Number.parseInt(jumpValue, 10);
    if (!Number.isFinite(nextPage)) return;
    onPageChange(Math.min(totalPages, Math.max(1, nextPage)));
    setJumpValue("");
  }

  if (total <= 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40",
        compact ? "px-3 py-2" : "px-4 py-3",
        className,
      )}
    >
      <div
        className={cn(
          "flex gap-3",
          compact
            ? "flex-col"
            : "flex-col lg:flex-row lg:items-center lg:justify-between",
        )}
      >
        <p className="min-w-0 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          of {total} {itemLabel}
          {totalPages > 1 ? (
            <span className="text-zinc-500">
              {" "}
              · {page}/{totalPages}
            </span>
          ) : null}
        </p>

        {totalPages > 1 ? (
          <div
            className={cn(
              "flex min-w-0 items-center gap-3",
              compact ? "w-full overflow-x-auto" : "flex-wrap",
            )}
          >
            <nav
              className="inline-flex shrink-0 items-center overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
              aria-label="Pagination"
            >
              <PaginationEdgeButton
                label="Previous page"
                disabled={!canGoBack}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronIcon direction="left" />
              </PaginationEdgeButton>

              <div className="flex items-center border-x border-zinc-200 px-1 dark:border-zinc-700">
                {pages.map((item, index) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="inline-flex h-9 min-w-9 items-center justify-center text-zinc-400 select-none"
                      aria-hidden
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      disabled={loading}
                      onClick={() => onPageChange(item)}
                      aria-current={item === page ? "page" : undefined}
                      className={cn(
                        "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium transition-colors disabled:opacity-50",
                        item === page
                          ? "bg-cobalt-100 text-cobalt-800 dark:bg-cobalt-900/40 dark:text-cobalt-200"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>

              <PaginationEdgeButton
                label="Next page"
                disabled={!canGoForward}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronIcon direction="right" />
              </PaginationEdgeButton>
            </nav>

            {!compact && viewportWidth >= 768 ? (
              <form
                onSubmit={submitJump}
                className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"
              >
                <label htmlFor={jumpInputId}>Go to</label>
                <Input
                  id={jumpInputId}
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpValue}
                  onChange={(e) => setJumpValue(e.target.value)}
                  placeholder={String(page)}
                  className="h-9 w-14 px-2 text-center"
                  disabled={loading}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  className="h-9"
                >
                  Go
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PaginationEdgeButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:disabled:text-zinc-600"
    >
      {children}
    </button>
  );
}
