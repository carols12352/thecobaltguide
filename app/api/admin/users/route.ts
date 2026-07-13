import { adminRouteError } from "@/lib/api/admin-route-error";
import {
  jsonAdmin,
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireAdmin } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { moderationService } from "@/server/services/moderation-service";
import { z } from "zod";

const userIdQuerySchema = z.string().uuid();

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (userId) {
      const parsed = userIdQuerySchema.safeParse(userId.trim());
      if (!parsed.success) {
        return jsonValidationError(parsed.error.flatten());
      }

      const user = await moderationService.getUserForAdmin(parsed.data);
      if (!user) {
        return jsonNotFound("User not found");
      }

      return jsonAdmin({ user });
    }

    const limit = Number(searchParams.get("limit") ?? 100);
    const users = await moderationService.getUsersForAdmin(
      Number.isFinite(limit) ? limit : 100,
    );

    return jsonAdmin({ users });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Admin")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    captureException(error, { route: "GET /api/admin/users" });
    return adminRouteError("Failed to load users", error);
  }
}
