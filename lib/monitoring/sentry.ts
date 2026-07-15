import * as Sentry from "@sentry/nextjs";

type MonitoringContext = Record<string, unknown>;

function structuredLog(
  level: "error" | "warn" | "info",
  event: string,
  context: MonitoringContext = {},
) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context,
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}

export function captureException(
  error: unknown,
  context: MonitoringContext = {},
) {
  structuredLog("error", "server.exception", {
    ...context,
    error: error instanceof Error ? error.message : String(error),
  });
  Sentry.captureException(error, { extra: context });
}

export function captureMessage(
  message: string,
  context: MonitoringContext = {},
) {
  structuredLog("warn", "server.message", { message, ...context });
  Sentry.captureMessage(message, { extra: context });
}

/** Emit searchable operational measurements to logs and Sentry breadcrumbs. */
export function recordMetric(
  name: string,
  value: number,
  attributes: Record<string, string | number | boolean> = {},
) {
  structuredLog("info", "server.metric", { name, value, ...attributes });
  Sentry.addBreadcrumb({
    category: "metric",
    message: name,
    level: "info",
    data: { value, ...attributes },
  });
}

export async function observeOperation<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await Sentry.startSpan(
      { name, op: "function", attributes },
      operation,
    );
  } catch (error) {
    captureException(error, { operation: name, ...attributes });
    throw error;
  } finally {
    recordMetric(`${name}.duration_ms`, performance.now() - startedAt, attributes);
  }
}
