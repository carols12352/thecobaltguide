import {
  jsonError,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireAuth } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { flagService } from "@/server/services/flag-service";
import { userFlagsQuerySchema } from "@/server/validation/user-flags-query";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const parsed = userFlagsQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const result = await flagService.getFlagsForUser(user.id, {
      view: parsed.data.view,
      page: parsed.data.page,
      pageSize: parsed.data.limit,
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof AuthError) return jsonUnauthorized(error.message);
    captureException(error, { route: "GET /api/me/flags" });
    return jsonError("Failed to load flags", 500);
  }
}
