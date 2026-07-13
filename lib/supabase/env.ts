const PLACEHOLDER_PUBLISHABLE = "your-publishable-key";
const PLACEHOLDER_ANON = "your-anon-key";
const PLACEHOLDER_SECRET = "your-secret-key";
const PLACEHOLDER_SERVICE_ROLE = "your-service-role-key";

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

/** Browser-safe key: publishable (preferred) or legacy anon. */
export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }

  if (key === PLACEHOLDER_PUBLISHABLE || key === PLACEHOLDER_ANON) {
    throw new Error(
      "Supabase publishable key is still the placeholder from .env.example",
    );
  }

  return key;
}

/** Server-only key: secret (preferred) or legacy service_role. */
export function getSupabaseSecretKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  if (key === PLACEHOLDER_SECRET || key === PLACEHOLDER_SERVICE_ROLE) {
    throw new Error(
      "Supabase secret key is still the placeholder from .env.example",
    );
  }

  return key;
}
