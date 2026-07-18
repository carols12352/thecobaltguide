import type { Event } from "@sentry/nextjs";

const PRIVATE_DATA_KEY = /(authorization|cookie|email|password|body|query|token)/i;
const URL_DATA_KEY = /(^|[._-])(url|from|to)$/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_VALUE = /\bBearer\s+[A-Z0-9._~+/=-]+/gi;

function redactText(value: string): string {
  return value
    .replace(EMAIL_VALUE, "[redacted-email]")
    .replace(BEARER_VALUE, "Bearer [redacted]");
}

export function stripUrlQuery(value: string): string {
  try {
    const url = new URL(value, "https://local.invalid");
    const sanitized = url.pathname;
    return url.origin === "https://local.invalid"
      ? sanitized
      : `${url.origin}${sanitized}`;
  } catch {
    return redactText(value.split(/[?#]/)[0] ?? value);
  }
}

function sanitizeData(
  data: Record<string, unknown> | undefined,
  seen = new WeakSet<object>(),
): Record<string, unknown> | undefined {
  if (!data) return undefined;
  if (seen.has(data)) return { circular: "[redacted]" };
  seen.add(data);

  return Object.fromEntries(
    Object.entries(data).flatMap(([key, value]) => {
      if (PRIVATE_DATA_KEY.test(key)) return [];
      if (URL_DATA_KEY.test(key) && typeof value === "string") {
        return [[key, stripUrlQuery(value)]];
      }
      if (typeof value === "string") return [[key, redactText(value)]];
      if (Array.isArray(value)) {
        return [[
          key,
          value.map((item) =>
            item && typeof item === "object"
              ? sanitizeData(item as Record<string, unknown>, seen)
              : typeof item === "string"
                ? redactText(item)
                : item,
          ),
        ]];
      }
      if (value && typeof value === "object") {
        return [[key, sanitizeData(value as Record<string, unknown>, seen)]];
      }
      return [[key, value]];
    }),
  );
}

export function sanitizeBrowserEvent<T extends Event>(event: T): T {
  return {
    ...event,
    user: undefined,
    request: event.request
      ? {
          ...event.request,
          url: event.request.url
            ? stripUrlQuery(event.request.url)
            : undefined,
          cookies: undefined,
          data: undefined,
          headers: undefined,
          query_string: undefined,
        }
      : undefined,
    breadcrumbs: event.breadcrumbs?.map((breadcrumb) => ({
      ...breadcrumb,
      message: breadcrumb.message ? redactText(breadcrumb.message) : undefined,
      data: sanitizeData(breadcrumb.data),
    })),
    spans: event.spans?.map((span) => ({
      ...span,
      description: span.description ? redactText(span.description) : undefined,
      data: (sanitizeData(span.data) ?? {}) as typeof span.data,
    })),
  } as T;
}
