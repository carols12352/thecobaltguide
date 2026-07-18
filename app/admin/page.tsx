import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import type {
  AdminReport,
  AdminSession,
  AdminUser,
} from "@/components/admin/admin-dashboard-model";
import { getSessionUser } from "@/lib/auth/session";
import type { AdminFlagGroup } from "@/types/domain";
import { moderationService } from "@/server/services/moderation-service";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.profile?.status === "suspended") redirect("/account");

  const role = user.profile?.role ?? "user";
  if (role !== "moderator" && role !== "admin") {
    redirect("/account?error=moderator_required");
  }

  const [reports, flagGroups, placesResult, users] = await Promise.all([
    moderationService.getRecentReports(),
    moderationService.getOpenFlagGroups(),
    moderationService.getPlacesForAdmin({
      status: "active",
      page: 1,
      pageSize: 1,
    }),
    role === "admin" ? moderationService.getUsersForAdmin(100) : [],
  ]);

  const session: AdminSession = {
    id: user.id,
    email: user.email ?? null,
    username: user.profile?.username ?? null,
    role,
  };

  return (
    <AdminDashboard
      initial={{
        session,
        reports: reports as AdminReport[],
        flagGroups: flagGroups as AdminFlagGroup[],
        activePlaceCount: placesResult.total,
        users: users as AdminUser[],
      }}
    />
  );
}
