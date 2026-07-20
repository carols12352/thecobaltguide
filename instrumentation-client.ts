import * as Sentry from "@sentry/nextjs";
import { sanitizeBrowserEvent } from "@/lib/monitoring/client-sanitize";

const configuredSampleRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05",
);
const tracesSampleRate = Number.isFinite(configuredSampleRate)
  ? Math.min(1, Math.max(0, configuredSampleRate))
  : 0.05;
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

try {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production" && Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate,
    tracePropagationTargets: [/^\//],
    beforeSend: sanitizeBrowserEvent,
    beforeSendTransaction: sanitizeBrowserEvent,
  });
} catch {
  // Monitoring must never prevent hydration or user interaction.
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
