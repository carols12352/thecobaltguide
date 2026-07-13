import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

/** JSON for authenticated admin routes — never cache in browser or CDN. */
export function jsonAdmin<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    status: 200,
    ...init,
    headers: {
      ...PRIVATE_NO_STORE_HEADERS,
      ...(init?.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : init?.headers),
    },
  });
}

/** JSON for public map/search data — always revalidate, short CDN TTL. */
export function jsonPublicCached<T>(
  data: T,
  cacheControl: string,
  init?: ResponseInit,
) {
  return NextResponse.json(data, {
    status: 200,
    ...init,
    headers: {
      "Cache-Control": cacheControl,
      ...(init?.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : init?.headers),
    },
  });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status },
  );
}

export function jsonUnauthorized(message = "Authentication required") {
  return jsonError(message, 401);
}

export function jsonForbidden(message = "Forbidden") {
  return jsonError(message, 403);
}

export function jsonNotFound(message = "Not found") {
  return jsonError(message, 404);
}

export function jsonValidationError(details: unknown) {
  return jsonError("Validation failed", 422, details);
}

export function jsonRateLimited(resetAt: number) {
  return NextResponse.json(
    { error: "Rate limit exceeded", resetAt },
    { status: 429 },
  );
}
