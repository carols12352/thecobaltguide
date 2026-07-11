import {
  jsonError,
  jsonForbidden,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireModerator } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { moderationService } from "@/server/services/moderation-service";
import { adminPlacePatchSchema } from "@/server/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireModerator();
    const { id } = await params;

    const body = await request.json();
    const parsed = adminPlacePatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const place = await moderationService.updatePlace(id, parsed.data, user.id);
    return Response.json({ place });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    captureException(error, { route: "PATCH /api/admin/places/:id" });
    return jsonError("Failed to update place", 500);
  }
}
