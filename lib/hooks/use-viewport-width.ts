"use client";

import { useEffect, useState } from "react";

export function useViewportWidth() {
  const [width, setWidth] = useState(1024);

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return width;
}
