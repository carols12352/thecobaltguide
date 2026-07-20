import type {
  PaymentContext,
  PlaceStatus,
  ReportKind,
  ReportStatus,
  UserRole,
  UserStatus,
} from "@/types/domain";

export type AdminTab = "overview" | "reports" | "flags" | "places" | "users";

export interface AdminSession {
  id: string;
  email: string | null;
  username: string | null;
  role: UserRole;
}

export interface AdminReport {
  id: string;
  multiplier: string;
  transaction_date: string;
  payment_context: PaymentContext;
  notes: string | null;
  status: ReportStatus;
  report_kind: ReportKind;
  moderation_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  place_id: string;
  places: { id: string; name: string; city: string; province: string } | null;
  reporter: { id: string; username: string | null } | null;
}

export interface AdminPlace {
  id: string;
  name: string;
  address_line1: string | null;
  city: string;
  province: string;
  postal_code: string | null;
  category: string;
  status: PlaceStatus;
  created_at: string;
}

export interface AdminUser {
  id: string;
  username: string | null;
  role: UserRole;
  status: UserStatus;
  report_count: number;
  reputation_score: number;
  created_at: string;
}

export type AdminUserUpdate = {
  role?: AdminUser["role"];
  status?: AdminUser["status"];
  reputationScore?: number;
};

export const PAYMENT_CONTEXT_LABELS: Record<PaymentContext, string> = {
  in_store: "In store",
  online: "Online",
  gas_pump: "Gas pump",
  delivery: "Delivery",
  other: "Other",
};

export const ADMIN_TABS: {
  id: AdminTab;
  label: string;
  adminOnly?: boolean;
}[] = [
  { id: "overview", label: "Overview" },
  { id: "reports", label: "Reports" },
  { id: "flags", label: "Flags" },
  { id: "places", label: "Places" },
  { id: "users", label: "Users", adminOnly: true },
];

export function adminTabIndexForKey(
  currentIndex: number,
  total: number,
  key: "ArrowLeft" | "ArrowRight" | "Home" | "End",
) {
  if (total <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return total - 1;
  return (currentIndex + (key === "ArrowRight" ? 1 : -1) + total) % total;
}

export function formatAdminDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function reportStatusVariant(
  status: AdminReport["status"],
): "success" | "warning" | "danger" | "muted" {
  if (status === "active") return "success";
  if (status === "flagged") return "warning";
  return "muted";
}

export function placeStatusVariant(
  status: AdminPlace["status"],
): "success" | "warning" | "muted" {
  if (status === "active") return "success";
  if (status === "permanently_closed") return "warning";
  return "muted";
}
