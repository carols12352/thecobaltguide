import { CDN_CACHE_DURATIONS } from "@/config/constants";
import {
  jsonError,
  jsonNotFound,
  jsonPublicCached,
  publicCdnCacheControl,
} from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { placeService } from "@/server/services/place-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const place = await placeService.getPlaceById(id);

    if (!place) return jsonNotFound("Place not found");

    return jsonPublicCached(
      { place },
      publicCdnCacheControl(CDN_CACHE_DURATIONS.placeDetailsSeconds),
    );
  } catch (error) {
    captureException(error, { route: "GET /api/places/:id" });
    return jsonError("Failed to load place", 500);
  }
}
