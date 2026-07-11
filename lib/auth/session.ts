import { createClient } from "@/lib/supabase/server";
import type { UserProfile, UserRole } from "@/types/domain";

export interface SessionUser {
  id: string;
  email: string | undefined;
  profile: UserProfile | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    profile: profile
      ? {
          id: profile.id,
          username: profile.username,
          role: profile.role as UserRole,
          reputationScore: profile.reputation_score,
          reportCount: profile.report_count,
          status: profile.status,
        }
      : null,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError("Authentication required");
  }
  if (user.profile?.status === "suspended") {
    throw new AuthError("Account suspended");
  }
  return user;
}

export async function requireModerator(): Promise<SessionUser> {
  const user = await requireAuth();
  const role = user.profile?.role ?? "user";
  if (role !== "moderator" && role !== "admin") {
    throw new AuthError("Moderator access required");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.profile?.role !== "admin") {
    throw new AuthError("Admin access required");
  }
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
