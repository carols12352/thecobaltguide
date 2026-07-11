import type { UserRole } from "@/types/domain";

export type Permission =
  | "browse_map"
  | "view_places"
  | "submit_multiplier"
  | "create_place"
  | "flag_content"
  | "remove_reports"
  | "manage_users"
  | "change_config";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [
    "browse_map",
    "view_places",
    "submit_multiplier",
    "create_place",
    "flag_content",
  ],
  moderator: [
    "browse_map",
    "view_places",
    "submit_multiplier",
    "create_place",
    "flag_content",
    "remove_reports",
  ],
  admin: [
    "browse_map",
    "view_places",
    "submit_multiplier",
    "create_place",
    "flag_content",
    "remove_reports",
    "manage_users",
    "change_config",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isModeratorOrAbove(role: UserRole): boolean {
  return role === "moderator" || role === "admin";
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export const GUEST_PERMISSIONS: Permission[] = ["browse_map", "view_places"];

export function guestHasPermission(permission: Permission): boolean {
  return GUEST_PERMISSIONS.includes(permission);
}
