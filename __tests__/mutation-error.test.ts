import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/monitoring/sentry", () => ({ captureException: vi.fn() }));

import { mutationRouteError } from "@/lib/api/mutation-error";
import { ServiceError } from "@/server/services/service-error";
import { captureException } from "@/lib/monitoring/sentry";

describe("mutationRouteError", () => {
  it("returns a stable code for expected conflicts", async () => {
    const response = mutationRouteError(
      new ServiceError("CONFLICT", "Already submitted", 409),
      { route: "POST /test", fallbackMessage: "Failed" },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Already submitted",
      code: "CONFLICT",
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("captures unexpected failures without exposing details", async () => {
    const error = new Error("database secret");
    const response = mutationRouteError(error, {
      route: "PATCH /test",
      fallbackMessage: "Could not update",
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Could not update",
      code: "INTERNAL_ERROR",
    });
    expect(captureException).toHaveBeenCalledWith(error, { route: "PATCH /test" });
  });
});
