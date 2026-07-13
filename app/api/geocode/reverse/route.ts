import {
  jsonError,
  jsonOk,
  jsonValidationError,
} from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { rankGeocodeResults } from "@/lib/geocoding/parse-result";
import { geocodingService } from "@/server/services/geocoding-service";
import { reverseGeocodeQuerySchema } from "@/server/validation/schemas";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = reverseGeocodeQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const results = rankGeocodeResults(
      await geocodingService.reverseGeocodeAt(
        parsed.data.latitude,
        parsed.data.longitude,
      ),
    );

    return jsonOk({ results });
  } catch (error) {
    captureException(error, { route: "GET /api/geocode/reverse" });
    return jsonError("Reverse geocoding failed", 500);
  }
}
