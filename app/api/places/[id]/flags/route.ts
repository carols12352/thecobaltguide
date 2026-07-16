import {
  jsonCreated,
  jsonRateLimited,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireAuth } from "@/lib/auth/session";
import { checkIpWriteRateLimit, getClientIp } from "@/lib/rate-limit";
import { mutationRouteError } from "@/lib/api/mutation-error";
import { moderationService } from "@/server/services/moderation-service";
import { createFlagSchema } from "@/server/validation/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: placeId } = await params;
    const ip = getClientIp(request);

    const ipLimit = await checkIpWriteRateLimit(ip);
    if (!ipLimit.allowed) return jsonRateLimited(ipLimit.resetAt);

    const body = await request.json();
    const parsed = createFlagSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const flag = await moderationService.submitFlag(
      placeId,
      user.id,
      parsed.data,
    );

    return jsonCreated({ flag });
  } catch (error) {
    if (error instanceof AuthError) return jsonUnauthorized(error.message);
    return mutationRouteError(error, {
      route: "POST /api/places/:id/flags",
      fallbackMessage: "Failed to submit flag",
    });
  }
}
