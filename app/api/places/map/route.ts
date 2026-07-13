import { CACHE_DURATIONS } from "@/config/constants";
import {
  jsonError,
  jsonPublicCached,
  jsonValidationError,
} from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { placeService } from "@/server/services/place-service";
import { viewportQuerySchema } from "@/server/validation/schemas";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = viewportQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const result = await placeService.getMapPlaces(parsed.data);

    return jsonPublicCached(
      result,
      `public, max-age=0, s-maxage=${CACHE_DURATIONS.mapRegionSeconds}, must-revalidate`,
    );
  } catch (error) {
    captureException(error, { route: "GET /api/places/map" });
    return jsonError("Failed to load map places", 500);
  }
}
