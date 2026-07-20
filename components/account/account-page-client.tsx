"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountDashboard } from "@/components/account/account-dashboard";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  ACCOUNT_REPORTS_PAGE_SIZE,
  type UserReportListView,
} from "@/lib/reports/user-report-state";
import {
  ACCOUNT_FLAGS_PAGE_SIZE,
  type UserFlagListView,
} from "@/lib/flags/user-flag-state";
import { createClient } from "@/lib/supabase/client";
import type { MultiplierReport, UserPlaceFlag, UserRole } from "@/types/domain";

interface AccountInitialData {
  email: string;
  role: UserRole;
  reputationScore: number;
  reportCount: number;
  reports: MultiplierReport[];
  reportsTotal: number;
  flags: UserPlaceFlag[];
  flagsTotal: number;
}

export function AccountPageClient({ initial }: { initial: AccountInitialData }) {
  const router = useRouter();
  const [reports, setReports] = useState(initial.reports);
  const [reportsTotal, setReportsTotal] = useState(initial.reportsTotal);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportView, setReportView] = useState<UserReportListView>("active");
  const [reportsLoading, setReportsLoading] = useState(false);
  const [activeReportsTotal, setActiveReportsTotal] = useState(
    initial.reportsTotal,
  );
  const [reputationScore, setReputationScore] = useState(
    initial.reputationScore,
  );
  const [reportCount, setReportCount] = useState(initial.reportCount);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [flags, setFlags] = useState(initial.flags);
  const [flagsTotal, setFlagsTotal] = useState(initial.flagsTotal);
  const [flagsPage, setFlagsPage] = useState(1);
  const [flagView, setFlagView] = useState<UserFlagListView>("active");
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [activeFlagsTotal, setActiveFlagsTotal] = useState(initial.flagsTotal);

  const loadReports = useCallback(
    async (view: UserReportListView, page: number) => {
      setReportsLoading(true);
      try {
        const params = new URLSearchParams({
          view,
          page: String(page),
          limit: String(ACCOUNT_REPORTS_PAGE_SIZE),
        });
        const response = await fetch(`/api/me/reports?${params.toString()}`);
        if (!response.ok) return;
        const data = await response.json();
        setReports(data.reports ?? []);
        setReportsTotal(data.total ?? 0);
        if (view === "active") setActiveReportsTotal(data.total ?? 0);
      } finally {
        setReportsLoading(false);
      }
    },
    [],
  );

  const loadFlags = useCallback(
    async (view: UserFlagListView, page: number) => {
      setFlagsLoading(true);
      try {
        const params = new URLSearchParams({
          view,
          page: String(page),
          limit: String(ACCOUNT_FLAGS_PAGE_SIZE),
        });
        const response = await fetch(`/api/me/flags?${params.toString()}`);
        if (!response.ok) return;
        const data = await response.json();
        setFlags(data.flags ?? []);
        setFlagsTotal(data.total ?? 0);
        if (view === "active") setActiveFlagsTotal(data.total ?? 0);
      } finally {
        setFlagsLoading(false);
      }
    },
    [],
  );

  const refreshProfileCounts = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("reputation_score, report_count")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      setReputationScore(profile.reputation_score ?? 0);
      setReportCount(profile.report_count ?? 0);
    }

    await Promise.all([loadReports("active", 1), loadFlags("active", 1)]);
  }, [loadFlags, loadReports]);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function confirmDeleteReport() {
    if (!deleteTargetId) return;
    setDeleting(true);
    const response = await fetch(`/api/me/reports/${deleteTargetId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      await loadReports(reportView, reportsPage);
      await refreshProfileCounts();
    }
    setDeleting(false);
    setDeleteTargetId(null);
  }

  function handleReportViewChange(view: UserReportListView) {
    setReportView(view);
    setReportsPage(1);
    void loadReports(view, 1);
  }

  function handleFlagViewChange(view: UserFlagListView) {
    setFlagView(view);
    setFlagsPage(1);
    void loadFlags(view, 1);
  }

  return (
    <>
      <AccountDashboard
        email={initial.email}
        role={initial.role}
        reputationScore={reputationScore}
        reportCount={reportCount}
        activeReportsTotal={activeReportsTotal}
        activeFlagsTotal={activeFlagsTotal}
        reports={reports}
        reportsTotal={reportsTotal}
        reportsPage={reportsPage}
        reportView={reportView}
        reportsLoading={reportsLoading}
        flags={flags}
        flagsTotal={flagsTotal}
        flagsPage={flagsPage}
        flagView={flagView}
        flagsLoading={flagsLoading}
        onReportViewChange={handleReportViewChange}
        onReportsPageChange={(page) => {
          setReportsPage(page);
          void loadReports(reportView, page);
        }}
        onFlagViewChange={handleFlagViewChange}
        onFlagsPageChange={(page) => {
          setFlagsPage(page);
          void loadFlags(flagView, page);
        }}
        onSignOut={signOut}
        onDeleteReport={setDeleteTargetId}
      />

      <ConfirmDialog
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteReport}
        title="Remove this report?"
        description="This report will be removed from the community summary for this merchant."
        confirmLabel="Remove report"
        loading={deleting}
      />
    </>
  );
}
