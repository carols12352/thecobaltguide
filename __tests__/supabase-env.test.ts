import { afterEach, describe, expect, it } from "vitest";
import {
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
});

describe("supabase env", () => {
  it("prefers publishable and secret keys", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "legacy-anon";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service";

    expect(getSupabaseUrl()).toBe("https://example.supabase.co");
    expect(getSupabasePublishableKey()).toBe("sb_publishable_test");
    expect(getSupabaseSecretKey()).toBe("sb_secret_test");
  });

  it("falls back to legacy anon and service role keys", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "legacy-anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service";

    expect(getSupabasePublishableKey()).toBe("legacy-anon");
    expect(getSupabaseSecretKey()).toBe("legacy-service");
  });
});
