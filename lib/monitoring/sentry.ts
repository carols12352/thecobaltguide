/** Sentry integration stub — wire up @sentry/nextjs after installing dependencies. */

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.error("[monitoring]", error, context);
  }
  // Sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.warn("[monitoring]", message, context);
  }
  // Sentry.captureMessage(message, { extra: context });
}
