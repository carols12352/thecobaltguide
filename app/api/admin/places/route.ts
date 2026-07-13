import { adminRouteError } from "@/lib/api/admin-route-error";
import { jsonAdmin, jsonForbidden, jsonUnauthorized } from "@/lib/api/response";
import { AuthError, requireModerator } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { moderationService } from "@/server/services/moderation-service";

export async function GET(request: Request) {
  try {
    await requireModerator();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const query = searchParams.get("q") ?? undefined;
    const page = Number(searchParams.get("page") ?? 1);
    const pageSize = Number(searchParams.get("limit") ?? 10);

    const result = await moderationService.getPlacesForAdmin({
      query,
      status: status && status !== "all" ? status : undefined,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 10,
    });

    return jsonAdmin(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    captureException(error, { route: "GET /api/admin/places" });
    return adminRouteError("Failed to load places", error);
  }
}
