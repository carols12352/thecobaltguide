import { z } from "zod";
import {
  jsonError,
  jsonOk,
  jsonRateLimited,
  jsonValidationError,
} from "@/lib/api/response";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { captureException } from "@/lib/monitoring/sentry";
import { authAccountService } from "@/server/services/auth-account-service";

const querySchema = z.object({
  email: z.string().email().max(200),
});

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`auth-hints:${ip}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) return jsonRateLimited(limit.resetAt);

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      email: searchParams.get("email"),
    });

    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const hints = await authAccountService.lookupByEmail(parsed.data.email);

    return jsonOk({
      exists: hints.exists,
      providers: hints.providers,
      lastProvider: hints.lastProvider,
    });
  } catch (error) {
    captureException(error, { route: "GET /api/auth/account-hints" });
    return jsonError("Could not look up account", 500);
  }
}
