import { CACHE_DURATIONS } from "@/config/constants";
import {
  jsonError,
  jsonPublicCached,
  jsonValidationError,
} from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { placeService } from "@/server/services/place-service";
import { searchQuerySchema } from "@/server/validation/schemas";

export async function GET(request: Request) {
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
    );

    return jsonPublicCached(
      { places },
      `public, max-age=0, s-maxage=${CACHE_DURATIONS.searchSeconds}, must-revalidate`,
    );
  } catch (error) {
    captureException(error, { route: "GET /api/places/search" });
    return jsonError("Search failed", 500);
  }
}
