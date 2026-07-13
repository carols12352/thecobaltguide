import {
  jsonAdmin,
  jsonForbidden,
  jsonUnauthorized,
} from "@/lib/api/response";
import { AuthError, requireModerator } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requireModerator();
    return jsonAdmin({
      id: user.id,
      email: user.email ?? null,
      username: user.profile?.username ?? null,
      role: user.profile?.role ?? "user",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message.includes("Moderator")
        ? jsonForbidden(error.message)
        : jsonUnauthorized(error.message);
    }
    throw error;
  }
}
