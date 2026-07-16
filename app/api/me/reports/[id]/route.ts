import {
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/response";
import { AuthError, requireAuth } from "@/lib/auth/session";
import { mutationRouteError } from "@/lib/api/mutation-error";
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
    return mutationRouteError(error, {
      route: "DELETE /api/me/reports/:id",
      fallbackMessage: "Failed to delete report",
    });
  }
}
