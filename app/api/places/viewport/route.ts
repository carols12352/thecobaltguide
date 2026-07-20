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
import { viewportDetailsQuerySchema } from "@/server/validation/schemas";

export async function GET(request: Request) {
  const timing = new ServerTiming();

  try {
    const { searchParams } = new URL(request.url);
    const parsed = viewportDetailsQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const result = await placeService.getViewportDetails(parsed.data, timing);

    return withServerTiming(
      jsonPublicCached(
        result,
        publicCdnCacheControl(CDN_CACHE_DURATIONS.mapViewportDetailsSeconds),
      ),
      timing,
    );
  } catch (error) {
    captureException(error, { route: "GET /api/places/viewport" });
    return jsonError("Failed to load viewport details", 500);
  }
}
