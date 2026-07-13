import { CDN_CACHE_DURATIONS } from "@/config/constants";
import { ServerTiming } from "@/lib/api/server-timing";
import {
  jsonError,
  jsonPublicCached,
  jsonValidationError,
  publicCdnCacheControl,
} from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { placeService } from "@/server/services/place-service";
import { viewportQuerySchema } from "@/server/validation/schemas";

function withServerTiming(
  response: Response,
  timing: ServerTiming,
): Response {
  const header = timing.headerValue();
  if (!header) return response;
  response.headers.set("Server-Timing", header);
  return response;
}

export async function GET(request: Request) {
  const timing = new ServerTiming();

  try {
    const { searchParams } = new URL(request.url);
    const parsed = viewportQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const gridQuery = {
      north: parsed.data.north,
      south: parsed.data.south,
      east: parsed.data.east,
      west: parsed.data.west,
      zoom: parsed.data.zoom,
      multiplier: parsed.data.multiplier,
      category: parsed.data.category,
      card: parsed.data.card,
    };

    const result = await placeService.getMapPlaces(gridQuery, timing);

    return withServerTiming(
      jsonPublicCached(
        result,
        publicCdnCacheControl(CDN_CACHE_DURATIONS.mapRegionSeconds),
      ),
      timing,
    );
  } catch (error) {
    captureException(error, { route: "GET /api/places/map" });
    return jsonError("Failed to load map places", 500);
  }
}
