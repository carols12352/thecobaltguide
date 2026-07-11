import { jsonError, jsonForbidden, jsonUnauthorized } from "@/lib/api/response";
import { AuthError, requireModerator } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { moderationService } from "@/server/services/moderation-service";

export async function GET() {
  try {
    await requireModerator();
    const reports = await moderationService.getRecentReports();
    return Response.json({ reports });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    captureException(error, { route: "GET /api/admin/reports" });
    return jsonError("Failed to load admin reports", 500);
  }
}
