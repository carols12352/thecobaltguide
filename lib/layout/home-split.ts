/** Places list width on desktop; map fills remaining space. */
export function getHomeListWidthPx(viewportWidth: number): number {
  if (viewportWidth < 1024) {
    return viewportWidth;
  }

  const ratio =
    viewportWidth >= 1600 ? 0.26 : viewportWidth >= 1280 ? 0.3 : 0.34;

  return Math.round(Math.min(440, Math.max(280, viewportWidth * ratio)));
}

export function isHomeSplitLayout(viewportWidth: number): boolean {
  return viewportWidth >= 1024;
}
