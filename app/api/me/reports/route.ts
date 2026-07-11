import { jsonError, jsonUnauthorized } from "@/lib/api/response";
import { AuthError, requireAuth } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { reportService } from "@/server/services/report-service";

export async function GET() {
  try {
    const user = await requireAuth();
    const reports = await reportService.getReportsForUser(user.id);
    return Response.json({ reports });
  } catch (error) {
    if (error instanceof AuthError) return jsonUnauthorized(error.message);
    captureException(error, { route: "GET /api/me/reports" });
    return jsonError("Failed to load reports", 500);
  }
}
