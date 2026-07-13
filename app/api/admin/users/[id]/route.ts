import {
  jsonAdmin,
  jsonError,
  jsonForbidden,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireAdmin } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
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
    captureException(error, { route: "PATCH /api/admin/users/:id" });
    return jsonError("Failed to update user", 500);
  }
}
