import { describe, expect, it } from "vitest";
import { ServerTiming, withServerTiming } from "@/lib/api/server-timing";

describe("ServerTiming", () => {
  it("attaches measured marks to a response", async () => {
    const timing = new ServerTiming();
    await timing.measure("redis", async () => "hit");

    const response = withServerTiming(Response.json({ ok: true }), timing);

    expect(response.headers.get("server-timing")).toMatch(/^redis;dur=\d+\.\d$/);
  });

  it("leaves responses without marks unchanged", () => {
    const response = withServerTiming(
      Response.json({ ok: true }),
      new ServerTiming(),
    );

    expect(response.headers.has("server-timing")).toBe(false);
  });
});
