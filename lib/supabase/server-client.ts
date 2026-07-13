import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

export function getSupabaseEnv() {
  return {
    url: getSupabaseUrl(),
    key: getSupabasePublishableKey(),
  };
}

export function createSupabaseServerClient(cookies: CookieMethodsServer) {
  const { url, key } = getSupabaseEnv();
  return createServerClient(url, key, { cookies });
}
