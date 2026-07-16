import { jsonError } from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { ServiceError } from "@/server/services/service-error";

export function mutationRouteError(
  error: unknown,
  context: { route: string; fallbackMessage: string },
): Response {
  if (error instanceof ServiceError) {
    return jsonError(error.message, error.status, undefined, error.code);
  }

  captureException(error, { route: context.route });
  return jsonError(context.fallbackMessage, 500, undefined, "INTERNAL_ERROR");
}
