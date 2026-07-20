import {
  jsonError,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireAuth } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { accountDataService } from "@/server/services/account-data-service";
import { accountDeletionSchema } from "@/server/validation/account-data";

export async function GET() {
  try {
    const user = await requireAuth();
    const data = await accountDataService.exportForUser(user.id);

    return Response.json(data, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="cobalt-account-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return jsonUnauthorized(error.message);
    captureException(error, { route: "GET /api/me/data" });
    return jsonError("Could not export account data", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth();
    const parsed = accountDeletionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const result = await accountDataService.deleteForUser(user.id);
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof AuthError) return jsonUnauthorized(error.message);
    captureException(error, { route: "DELETE /api/me/data" });
    return jsonError("Could not delete account", 500);
  }
}
