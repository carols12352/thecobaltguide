import {
  jsonAdmin,
  jsonForbidden,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireAdmin } from "@/lib/auth/session";
import { mutationRouteError } from "@/lib/api/mutation-error";
import { moderationService } from "@/server/services/moderation-service";
import { adminUserPatchSchema } from "@/server/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = adminUserPatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const profile = await moderationService.updateUser(
      id,
      parsed.data,
      admin.id,
    );

    return jsonAdmin({ profile });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Admin")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    return mutationRouteError(error, {
      route: "PATCH /api/admin/users/:id",
      fallbackMessage: "Failed to update user",
    });
  }
}
