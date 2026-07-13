import { adminRouteError } from "@/lib/api/admin-route-error";
import {
  jsonAdmin,
  jsonForbidden,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireModerator } from "@/lib/auth/session";
import { captureException } from "@/lib/monitoring/sentry";
import { moderationService } from "@/server/services/moderation-service";
import { adminPlaceSearchQuerySchema } from "@/server/validation/schemas";

const PLACE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    await requireModerator();
    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams);

    const hasStructuredSearch = Boolean(
      raw.placeId?.trim() ||
        raw.name?.trim() ||
        raw.postalCode?.trim() ||
        raw.addressLine1?.trim() ||
        raw.q?.trim(),
    );

    if (!hasStructuredSearch) {
      const page = Number(raw.page ?? 1);
      const pageSize = Number(raw.limit ?? 10);
      const status = raw.status?.trim() || undefined;

      const result = await moderationService.getPlacesForAdmin({
        status: status && status !== "all" ? status : undefined,
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 10,
      });

      return jsonAdmin(result);
    }

    const nameInput = raw.name?.trim() || raw.q?.trim() || undefined;
    const parsed = adminPlaceSearchQuerySchema.safeParse({
      placeId:
        raw.placeId?.trim() ||
        (nameInput && PLACE_ID_PATTERN.test(nameInput) ? nameInput : undefined),
      name:
        nameInput && PLACE_ID_PATTERN.test(nameInput) ? undefined : nameInput,
      postalCode: raw.postalCode,
      addressLine1: raw.addressLine1,
      status: raw.status,
      page: raw.page,
      limit: raw.limit,
    });

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const result = await moderationService.getPlacesForAdmin({
      placeId: parsed.data.placeId,
      name: parsed.data.name,
      postalCode: parsed.data.postalCode,
      addressLine1: parsed.data.addressLine1,
      status:
        parsed.data.status && parsed.data.status !== "all"
          ? parsed.data.status
          : undefined,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return jsonAdmin(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    captureException(error, { route: "GET /api/admin/places" });
    return adminRouteError("Failed to load places", error);
  }
}
