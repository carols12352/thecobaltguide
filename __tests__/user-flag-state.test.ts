import { describe, expect, it } from "vitest";
import {
  isActiveUserFlag,
  isArchivedUserFlag,
  userFlagStatusLabel,
} from "@/lib/flags/user-flag-state";
import type { FlagStatus } from "@/types/domain";

function flagWithStatus(status: FlagStatus) {
  return { status };
}

describe("user flag list views", () => {
  it("keeps open flags active and reviewed ones archived", () => {
    expect(isActiveUserFlag(flagWithStatus("open"))).toBe(true);
    expect(isArchivedUserFlag(flagWithStatus("open"))).toBe(false);

    expect(isActiveUserFlag(flagWithStatus("resolved"))).toBe(false);
    expect(isArchivedUserFlag(flagWithStatus("resolved"))).toBe(true);

    expect(isActiveUserFlag(flagWithStatus("dismissed"))).toBe(false);
    expect(isArchivedUserFlag(flagWithStatus("dismissed"))).toBe(true);
  });

  it("labels flag statuses for account UI", () => {
    expect(userFlagStatusLabel(flagWithStatus("open"))).toBe("Open");
    expect(userFlagStatusLabel(flagWithStatus("resolved"))).toBe("Resolved");
    expect(userFlagStatusLabel(flagWithStatus("dismissed"))).toBe("Dismissed");
  });
});
