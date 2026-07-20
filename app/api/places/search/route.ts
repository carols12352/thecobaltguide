import { CDN_CACHE_DURATIONS } from "@/config/constants";
import { ServerTiming, withServerTiming } from "@/lib/api/server-timing";
import {
  jsonError,
  jsonPublicCached,
  jsonValidationError,
  publicCdnCacheControl,
} from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { placeService } from "@/server/services/place-service";
import { searchQuerySchema } from "@/server/validation/schemas";

export async function GET(request: Request) {
  const timing = new ServerTiming();

  try {
    const { searchParams } = new URL(request.url);
    const parsed = searchQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const places = await placeService.searchPlaces(
      parsed.data.q,
      parsed.data.limit,
      timing,
    );

    return withServerTiming(
      jsonPublicCached(
        { places },
        publicCdnCacheControl(CDN_CACHE_DURATIONS.searchSeconds),
      ),
      timing,
    );
  } catch (error) {
    captureException(error, { route: "GET /api/places/search" });
    return jsonError("Search failed", 500);
  }
}
