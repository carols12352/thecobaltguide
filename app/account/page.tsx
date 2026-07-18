import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountPageClient } from "@/components/account/account-page-client";
import { getSessionUser } from "@/lib/auth/session";
import { ACCOUNT_FLAGS_PAGE_SIZE } from "@/lib/flags/user-flag-state";
import { ACCOUNT_REPORTS_PAGE_SIZE } from "@/lib/reports/user-report-state";
import { flagService } from "@/server/services/flag-service";
import { reportService } from "@/server/services/report-service";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  if (user.profile?.status === "suspended") redirect("/login?error=suspended");

  const [reports, flags] = await Promise.all([
    reportService.getReportsForUser(user.id, {
      view: "active",
      page: 1,
      pageSize: ACCOUNT_REPORTS_PAGE_SIZE,
    }),
    flagService.getFlagsForUser(user.id, {
      view: "active",
      page: 1,
      pageSize: ACCOUNT_FLAGS_PAGE_SIZE,
    }),
  ]);

  return (
    <AccountPageClient
      initial={{
        email: user.email ?? "Signed-in user",
        role: user.profile?.role ?? "user",
        reputationScore: user.profile?.reputationScore ?? 0,
        reportCount: user.profile?.reportCount ?? 0,
        reports: reports.reports,
        reportsTotal: reports.total,
        flags: flags.flags,
        flagsTotal: flags.total,
      }}
    />
  );
}
