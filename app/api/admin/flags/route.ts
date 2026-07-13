import { adminRouteError } from "@/lib/api/admin-route-error";
import { jsonAdmin, jsonForbidden, jsonUnauthorized } from "@/lib/api/response";
import { AuthError, requireModerator } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { moderationService } from "@/server/services/moderation-service";

export async function GET() {
  try {
    await requireModerator();
    const flags = await moderationService.getOpenFlags();
    return jsonAdmin({ flags });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    captureException(error, { route: "GET /api/admin/flags" });
    return adminRouteError("Failed to load flags", error);
  }
}
