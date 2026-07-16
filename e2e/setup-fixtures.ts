import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PASSWORD = "E2e-Password-123!";
const USER_EMAIL = "e2e-user@example.com";
const MODERATOR_EMAIL = "e2e-moderator@example.com";

type LocalEnvironment = {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
};

function localEnvironment(): LocalEnvironment {
  const output = execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const environment = JSON.parse(output) as Partial<LocalEnvironment>;
  if (!environment.API_URL || !environment.ANON_KEY || !environment.SERVICE_ROLE_KEY) {
    throw new Error("Local Supabase did not return the required E2E credentials");
  }
  return environment as LocalEnvironment;
}

async function createUser(
  admin: SupabaseClient,
  input: { email: string; username: string; role: "user" | "moderator" },
): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: input.email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error(`Could not create ${input.email}`);
  }
  const userId = created.data.user.id;
  const { error } = await admin.from("profiles").upsert({
    id: userId,
    username: input.username,
    role: input.role,
    status: "active",
  });
  if (error) throw error;
  return userId;
}

function githubEnvironmentPath(): string {
  const flagIndex = process.argv.indexOf("--github-env");
  const path = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
  if (!path) throw new Error("Pass --github-env with the GitHub environment file path");
  return path;
}

async function main() {
  const environment = localEnvironment();
  const admin = createClient(environment.API_URL, environment.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userId = await createUser(admin, {
    email: USER_EMAIL,
    username: "e2e-user",
    role: "user",
  });
  await createUser(admin, {
    email: MODERATOR_EMAIL,
    username: "e2e-moderator",
    role: "moderator",
  });

  const { data: place, error: placeError } = await admin.from("places").insert({
    name: "E2E Workflow Cafe",
    normalized_name: "e2e workflow cafe",
    address_line1: "1 Workflow Way",
    city: "Toronto",
    province: "ON",
    postal_code: "M5V1A1",
    country_code: "CA",
    location: "SRID=4326;POINT(-79.38 43.65)",
    category: "dining",
    status: "active",
    created_by: userId,
  }).select("id").single();
  if (placeError || !place) throw placeError ?? new Error("Could not create E2E place");

  const entries = {
    NEXT_PUBLIC_SUPABASE_URL: environment.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment.ANON_KEY,
    SUPABASE_SECRET_KEY: environment.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
    E2E_USER_EMAIL: USER_EMAIL,
    E2E_USER_PASSWORD: PASSWORD,
    E2E_MODERATOR_EMAIL: MODERATOR_EMAIL,
    E2E_MODERATOR_PASSWORD: PASSWORD,
    E2E_PLACE_ID: place.id as string,
  };
  appendFileSync(
    githubEnvironmentPath(),
    `${Object.entries(entries).map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
    "utf8",
  );
}

await main();
