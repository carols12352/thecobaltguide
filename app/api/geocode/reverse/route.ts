import {
  jsonError,
  jsonOk,
  jsonValidationError,
  jsonRateLimited,
  jsonUnauthorized,
} from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { rankGeocodeResults } from "@/lib/geocoding/parse-result";
import { geocodingService } from "@/server/services/geocoding-service";
import { reverseGeocodeQuerySchema } from "@/server/validation/schemas";
import { getSessionUser } from "@/lib/auth/session";
import {
  checkGeocodeIpRateLimit,
  checkGeocodeUserRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { getCachedGeocode, setCachedGeocode } from "@/lib/cache/geocode-cache";
import type { GeocodingResult } from "@/types/domain";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonUnauthorized();
    const [ipLimit, userLimit] = await Promise.all([
      checkGeocodeIpRateLimit(getClientIp(request)),
      checkGeocodeUserRateLimit(user.id),
    ]);
    if (!ipLimit.allowed) return jsonRateLimited(ipLimit.resetAt);
    if (!userLimit.allowed) return jsonRateLimited(userLimit.resetAt);

    const { searchParams } = new URL(request.url);
    const parsed = reverseGeocodeQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const cacheInput = {
      latitude: Number(parsed.data.latitude.toFixed(5)),
      longitude: Number(parsed.data.longitude.toFixed(5)),
    };
    const cached = await getCachedGeocode<{ results: GeocodingResult[] }>(
      "reverse",
      cacheInput,
    );
    if (cached) return jsonOk(cached);

    const results = rankGeocodeResults(
      await geocodingService.reverseGeocodeAt(
        parsed.data.latitude,
        parsed.data.longitude,
      ),
    );
    const result = { results };
    await setCachedGeocode("reverse", cacheInput, result);
    return jsonOk(result);
  } catch (error) {
    captureException(error, { route: "GET /api/geocode/reverse" });
    return jsonError("Reverse geocoding failed", 500);
  }
}
