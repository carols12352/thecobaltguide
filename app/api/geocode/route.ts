import {
  jsonError,
  jsonOk,
  jsonValidationError,
} from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { geocodingService } from "@/server/services/geocoding-service";
import { geocodeQuerySchema } from "@/server/validation/schemas";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = geocodeQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const { results, source } = await geocodingService.geocodeStructuredAddress(
      parsed.data,
    );

    return jsonOk({ results, source });
  } catch (error) {
    captureException(error, { route: "GET /api/geocode" });
    return jsonError("Geocoding failed", 500);
  }
}
