import {
  jsonError,
  jsonOk,
  jsonValidationError,
  jsonRateLimited,
  jsonUnauthorized,
} from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { geocodingService } from "@/server/services/geocoding-service";
import { geocodeQuerySchema } from "@/server/validation/schemas";
import { getSessionUser } from "@/lib/auth/session";
import {
  checkGeocodeIpRateLimit,
  checkGeocodeUserRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { getCachedGeocode, setCachedGeocode } from "@/lib/cache/geocode-cache";

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
    const parsed = geocodeQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const cached = await getCachedGeocode<{
      results: Awaited<ReturnType<typeof geocodingService.geocodeStructuredAddress>>["results"];
      source: Awaited<ReturnType<typeof geocodingService.geocodeStructuredAddress>>["source"];
    }>("forward", parsed.data);
    if (cached) return jsonOk(cached);

    const result = await geocodingService.geocodeStructuredAddress(parsed.data);
    await setCachedGeocode("forward", parsed.data, result);

    return jsonOk(result);
  } catch (error) {
    captureException(error, { route: "GET /api/geocode" });
    return jsonError("Geocoding failed", 500);
  }
}
