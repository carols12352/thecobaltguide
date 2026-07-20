import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAST_USED_AUTH_METHOD_KEY,
  formatLastUsedAuthMethod,
  getLastUsedAuthMethod,
  setLastUsedAuthMethod,
} from "@/lib/auth/last-used-method";

describe("last-used auth method", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
    });
  });

  it("stores only the method on the current device", () => {
    setLastUsedAuthMethod("google");

    expect(store.get(LAST_USED_AUTH_METHOD_KEY)).toBe("google");
    expect(getLastUsedAuthMethod()).toBe("google");
  });

  it("ignores malformed stored values", () => {
    store.set(LAST_USED_AUTH_METHOD_KEY, "unknown");
    expect(getLastUsedAuthMethod()).toBeNull();
  });

  it("formats labels without account data", () => {
    expect(formatLastUsedAuthMethod("magic_link")).toBe("Magic link");
  });
});
