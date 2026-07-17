import { describe, expect, it } from "vitest";
import { accountDeletionSchema } from "@/server/validation/account-data";

describe("account deletion confirmation", () => {
  it("requires the exact destructive confirmation", () => {
    expect(accountDeletionSchema.safeParse({ confirmation: "DELETE" }).success).toBe(
      true,
    );
    expect(accountDeletionSchema.safeParse({ confirmation: "delete" }).success).toBe(
      false,
    );
    expect(accountDeletionSchema.safeParse({}).success).toBe(false);
  });
});
