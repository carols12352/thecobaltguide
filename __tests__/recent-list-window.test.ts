import { describe, expect, it } from "vitest";
import {
  ACCOUNT_RECENT_LIST_DAYS,
  accountListSinceIso,
} from "@/lib/account/recent-list-window";

describe("accountListSinceIso", () => {
  it("returns an ISO timestamp 30 days before now by default", () => {
    const now = new Date("2026-07-13T12:00:00.000Z");
    const since = accountListSinceIso(ACCOUNT_RECENT_LIST_DAYS, now);

    expect(since).toBe("2026-06-13T12:00:00.000Z");
  });

  it("supports custom day windows", () => {
    const now = new Date("2026-01-31T00:00:00.000Z");
    const since = accountListSinceIso(7, now);

    expect(since).toBe("2026-01-24T00:00:00.000Z");
  });

  it("uses UTC calendar days when crossing month boundaries", () => {
    const now = new Date("2026-03-05T18:30:00.000Z");
    const since = accountListSinceIso(30, now);

    expect(since).toBe("2026-02-03T18:30:00.000Z");
  });
});
