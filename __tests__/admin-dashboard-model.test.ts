import { describe, expect, it } from "vitest";
import {
  ADMIN_TABS,
  PAYMENT_CONTEXT_LABELS,
  placeStatusVariant,
  reportStatusVariant,
} from "@/components/admin/admin-dashboard-model";

describe("admin dashboard model", () => {
  it("keeps user management restricted to the admin-only tab", () => {
    expect(ADMIN_TABS.find((tab) => tab.id === "users")?.adminOnly).toBe(true);
    expect(ADMIN_TABS.filter((tab) => tab.adminOnly)).toHaveLength(1);
  });

  it("labels every supported payment context", () => {
    expect(Object.keys(PAYMENT_CONTEXT_LABELS).sort()).toEqual([
      "delivery",
      "gas_pump",
      "in_store",
      "online",
      "other",
    ]);
  });

  it("maps report and place statuses to stable badge variants", () => {
    expect(reportStatusVariant("active")).toBe("success");
    expect(reportStatusVariant("flagged")).toBe("warning");
    expect(reportStatusVariant("removed")).toBe("muted");

    expect(placeStatusVariant("active")).toBe("success");
    expect(placeStatusVariant("permanently_closed")).toBe("warning");
    expect(placeStatusVariant("merged")).toBe("muted");
  });
});
