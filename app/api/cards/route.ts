import { jsonError, jsonOk } from "@/lib/api/response";
import { captureException } from "@/lib/monitoring/sentry";
import { cardRepository } from "@/server/repositories/flag-repository";

export async function GET() {
  try {
    const cards = await cardRepository.findAllActive();
    return jsonOk({ cards });
  } catch (error) {
    captureException(error, { route: "GET /api/cards" });
    return jsonError("Failed to load cards", 500);
  }
}
