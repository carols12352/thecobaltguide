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
  getClientIp,
} from "@/lib/rate-limit";
import { captureException } from "@/lib/monitoring/sentry";
import { reportService } from "@/server/services/report-service";
import { createReportSchema } from "@/server/validation/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const reports = await reportService.getReportsForPlace(id);
    return Response.json({ reports });
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

    const ipLimit = checkIpWriteRateLimit(ip);
    if (!ipLimit.allowed) return jsonRateLimited(ipLimit.resetAt);

    const reportLimit = checkUserReportRateLimit(user.id);
    if (!reportLimit.allowed) return jsonRateLimited(reportLimit.resetAt);

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
    captureException(error, { route: "POST /api/places/:id/reports" });
    return jsonError("Failed to submit report", 500);
  }
}
