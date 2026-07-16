import {
  jsonCreated,
  jsonOk,
  jsonRateLimited,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireAuth } from "@/lib/auth/session";
import {
  checkIpWriteRateLimit,
  checkUserPlaceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { mutationRouteError } from "@/lib/api/mutation-error";
import { placeService } from "@/server/services/place-service";
import { createPlaceSchema } from "@/server/validation/schemas";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const ip = getClientIp(request);

    const ipLimit = await checkIpWriteRateLimit(ip);
    if (!ipLimit.allowed) return jsonRateLimited(ipLimit.resetAt);

    const placeLimit = await checkUserPlaceRateLimit(user.id);
    if (!placeLimit.allowed) return jsonRateLimited(placeLimit.resetAt);

    const body = await request.json();
    const parsed = createPlaceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const result = await placeService.createPlace(parsed.data, user.id);

    if (!result.created) {
      return jsonOk({
        created: false,
        possibleDuplicates: result.possibleDuplicates,
      });
    }

    return jsonCreated({ created: true, placeId: result.place.id });
  } catch (error) {
    if (error instanceof AuthError) return jsonUnauthorized(error.message);
    return mutationRouteError(error, {
      route: "POST /api/places",
      fallbackMessage: "Failed to create place",
    });
  }
}
