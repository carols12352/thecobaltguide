import {
  jsonCreated,
  jsonError,
  jsonRateLimited,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/response";
import { AuthError, requireAuth } from "@/lib/auth/session";
import {
  checkIpWriteRateLimit,
  checkUserReportRateLimit,
  checkUserReportSubmitCooldown,
  getClientIp,
} from "@/lib/rate-limit";
import { captureException } from "@/lib/monitoring/sentry";
import { mutationRouteError } from "@/lib/api/mutation-error";
import { reportService } from "@/server/services/report-service";
import { createReportSchema } from "@/server/validation/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await reportService.getGroupedReportsForPlace(id);
    return Response.json(result);
  } catch (error) {
    captureException(error, { route: "GET /api/places/:id/reports" });
    return jsonError("Failed to load reports", 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: placeId } = await params;
    const ip = getClientIp(request);

    const ipLimit = await checkIpWriteRateLimit(ip);
    if (!ipLimit.allowed) return jsonRateLimited(ipLimit.resetAt);

    const reportLimit = await checkUserReportRateLimit(user.id);
    if (!reportLimit.allowed) return jsonRateLimited(reportLimit.resetAt);

    const submitCooldown = await checkUserReportSubmitCooldown(user.id);
    if (!submitCooldown.allowed) {
      return jsonRateLimited(submitCooldown.resetAt);
    }

    const body = await request.json();
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const report = await reportService.submitReport(
      placeId,
      user.id,
      parsed.data,
    );

    return jsonCreated({ report });
  } catch (error) {
    if (error instanceof AuthError) return jsonUnauthorized(error.message);
    return mutationRouteError(error, {
      route: "POST /api/places/:id/reports",
      fallbackMessage: "Failed to submit report",
    });
  }
}
