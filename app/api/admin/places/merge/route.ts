import {
  jsonAdmin,
  jsonForbidden,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireModerator } from "@/lib/auth/session";
import { mutationRouteError } from "@/lib/api/mutation-error";
import { moderationService } from "@/server/services/moderation-service";
import { adminPlaceMergeSchema } from "@/server/validation/schemas";

export async function POST(request: Request) {
  try {
    const user = await requireModerator();
    const body = await request.json();
    const parsed = adminPlaceMergeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const result = await moderationService.mergePlaces(
      parsed.data.sourcePlaceId,
      parsed.data.targetPlaceId,
      user.id,
      parsed.data.reason,
    );

    return jsonAdmin(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    return mutationRouteError(error, {
      route: "POST /api/admin/places/merge",
      fallbackMessage: "Failed to merge places",
    });
  }
}
