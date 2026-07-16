import {
  jsonAdmin,
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { adminRouteError } from "@/lib/api/admin-route-error";
import { AuthError, requireModerator } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { mutationRouteError } from "@/lib/api/mutation-error";
import { moderationService } from "@/server/services/moderation-service";
import { adminPlacePatchSchema } from "@/server/validation/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireModerator();
    const { id } = await params;
    const place = await moderationService.getPlaceForAdmin(id);

    if (!place) {
      return jsonNotFound("Place not found");
    }

    return jsonAdmin({ place });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    captureException(error, { route: "GET /api/admin/places/:id" });
    return adminRouteError("Failed to load place", error);
  }
}

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
    const refreshed = await moderationService.getPlaceForAdmin(id);
    return jsonAdmin({ place: refreshed ?? place });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    return mutationRouteError(error, {
      route: "PATCH /api/admin/places/:id",
      fallbackMessage: "Failed to update place",
    });
  }
}
