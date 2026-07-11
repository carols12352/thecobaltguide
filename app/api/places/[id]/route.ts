import { CACHE_DURATIONS } from "@/config/constants";
import {
  jsonError,
  jsonNotFound,
  jsonOk,
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

    return jsonOk({ place }, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_DURATIONS.placeDetailsSeconds}, stale-while-revalidate=120`,
      },
    });
  } catch (error) {
    captureException(error, { route: "GET /api/places/:id" });
    return jsonError("Failed to load place", 500);
  }
}
