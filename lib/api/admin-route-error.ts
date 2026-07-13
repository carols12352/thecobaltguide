import { jsonError } from "@/lib/api/response";

export function adminRouteError(
  fallbackMessage: string,
  error: unknown,
): Response {
  const message =
    process.env.NODE_ENV === "development" && error instanceof Error
      ? error.message
      : fallbackMessage;

  return jsonError(message, 500);
}
