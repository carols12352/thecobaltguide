import type { UserRole } from "@/types/domain";

export function formatStaffRoleLabel(role: UserRole): string {
  if (role === "admin") return "admin";
  if (role === "moderator") return "moderator";
  return role;
}

export function staffRoleArticle(role: UserRole): "a" | "an" {
  return role === "admin" ? "an" : "a";
}
