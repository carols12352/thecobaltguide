export class ServerTiming {
  private marks: { name: string; dur: number; desc?: string }[] = [];

  async measure<T>(name: string, fn: () => Promise<T>, desc?: string): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.marks.push({ name, dur: performance.now() - start, desc });
    }
  }

  mark(name: string, durationMs: number, desc?: string): void {
    this.marks.push({ name, dur: durationMs, desc });
  }

  headerValue(): string | null {
    if (this.marks.length === 0) return null;
    return this.marks
      .map((mark) => {
        const base = `${mark.name};dur=${mark.dur.toFixed(1)}`;
        return mark.desc ? `${base};desc="${mark.desc}"` : base;
      })
      .join(", ");
  }
}

export function withServerTiming(
  response: Response,
  timing: ServerTiming,
): Response {
  const header = timing.headerValue();
  if (header) response.headers.set("Server-Timing", header);
  return response;
}
