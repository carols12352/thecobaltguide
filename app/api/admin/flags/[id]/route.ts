import {
  jsonError,
  jsonForbidden,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireModerator } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { moderationService } from "@/server/services/moderation-service";
import { adminFlagPatchSchema } from "@/server/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireModerator();
    const { id } = await params;

    const body = await request.json();
    const parsed = adminFlagPatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const flag = await moderationService.resolveFlag(
      id,
      parsed.data.status,
      user.id,
    );

    return Response.json({ flag });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    captureException(error, { route: "PATCH /api/admin/flags/:id" });
    return jsonError("Failed to update flag", 500);
  }
}
