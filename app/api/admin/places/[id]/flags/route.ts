import {
  jsonAdmin,
  jsonError,
  jsonForbidden,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { adminRouteError } from "@/lib/api/admin-route-error";
import { AuthError, requireModerator } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { moderationService } from "@/server/services/moderation-service";
import { adminPlaceFlagsPatchSchema } from "@/server/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireModerator();
    const { id } = await params;

    const body = await request.json();
    const parsed = adminPlaceFlagsPatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const result = await moderationService.resolveOpenFlagsForPlace(
      id,
      user.id,
      parsed.data.status,
    );
    const place = await moderationService.getPlaceForAdmin(id);

    return jsonAdmin({ ...result, place });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    captureException(error, { route: "PATCH /api/admin/places/:id/flags" });
    return jsonError("Failed to update place flags", 500);
  }
}
