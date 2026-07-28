import type { UserRole, UserStatus } from "@/types/domain";

export interface HeaderProfile {
  role: UserRole | null;
  status: UserStatus | null;
}

export function canShowAdminHeaderLink(
  profile: HeaderProfile | null,
): boolean {
  return profile?.role === "admin" && profile.status === "active";
}
