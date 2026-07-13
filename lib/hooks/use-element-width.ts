"use client";

import { useEffect, useState, type RefObject } from "react";

/** Tracks an element's content width via ResizeObserver. */
export function useElementWidth(
  ref: RefObject<Element | null>,
  fallback = 320,
) {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateWidth = () => {
      const next = element.getBoundingClientRect().width;
      if (next > 0) setWidth(next);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
