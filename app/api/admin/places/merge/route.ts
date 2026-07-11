import {
  jsonError,
  jsonForbidden,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireModerator } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
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

    return Response.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    captureException(error, { route: "POST /api/admin/places/merge" });
    return jsonError("Failed to merge places", 500);
  }
}
