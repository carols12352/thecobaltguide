import {
  jsonError,
  jsonNotFound,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/response";
import { AuthError, requireAuth } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { reportService } from "@/server/services/report-service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const report = await reportService.deleteOwnReport(id, user.id);
    return jsonOk({ report });
  } catch (error) {
    if (error instanceof AuthError) return jsonUnauthorized(error.message);
    if (error instanceof Error && error.message === "Report not found") {
      return jsonNotFound("Report not found");
    }
    if (error instanceof Error && error.message === "Report cannot be removed") {
      return jsonError("This report can no longer be removed.", 403);
    }
    captureException(error, { route: "DELETE /api/me/reports/:id" });
    return jsonError("Failed to delete report", 500);
  }
}
