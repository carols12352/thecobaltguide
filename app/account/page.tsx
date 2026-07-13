"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function AccountPage() {
  const router = useRouter();
  const [reports, setReports] = useState<MultiplierReport[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportView, setReportView] = useState<UserReportListView>("active");
  const [reportsLoading, setReportsLoading] = useState(false);
  const [activeReportsTotal, setActiveReportsTotal] = useState(0);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("user");
  const [reputationScore, setReputationScore] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [flags, setFlags] = useState<UserPlaceFlag[]>([]);
  const [flagsTotal, setFlagsTotal] = useState(0);
  const [flagsPage, setFlagsPage] = useState(1);
  const [flagView, setFlagView] = useState<UserFlagListView>("active");
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [activeFlagsTotal, setActiveFlagsTotal] = useState(0);

  const loadReports = useCallback(async (view: UserReportListView, page: number) => {
    setReportsLoading(true);
    const params = new URLSearchParams({
      view,
      page: String(page),
      limit: String(ACCOUNT_REPORTS_PAGE_SIZE),
    });
    const res = await fetch(`/api/me/reports?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setReports(data.reports ?? []);
      setReportsTotal(data.total ?? 0);
      if (view === "active") {
        setActiveReportsTotal(data.total ?? 0);
      }
    }
    setReportsLoading(false);
  }, []);

  const loadFlags = useCallback(async (view: UserFlagListView, page: number) => {
    setFlagsLoading(true);
    const params = new URLSearchParams({
      view,
      page: String(page),
      limit: String(ACCOUNT_FLAGS_PAGE_SIZE),
    });
    const res = await fetch(`/api/me/flags?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setFlags(data.flags ?? []);
      setFlagsTotal(data.total ?? 0);
      if (view === "active") {
        setActiveFlagsTotal(data.total ?? 0);
      }
    }
    setFlagsLoading(false);
  }, []);

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

    const activeRes = await fetch(
      `/api/me/reports?view=active&page=1&limit=${ACCOUNT_REPORTS_PAGE_SIZE}`,
    );
    if (activeRes.ok) {
      const activeData = await activeRes.json();
      setActiveReportsTotal(activeData.total ?? 0);
    }

    const activeFlagsRes = await fetch(
      `/api/me/flags?view=active&page=1&limit=${ACCOUNT_FLAGS_PAGE_SIZE}`,
    );
    if (activeFlagsRes.ok) {
      const activeFlagsData = await activeFlagsRes.json();
      setActiveFlagsTotal(activeFlagsData.total ?? 0);
    }
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/account");
        return;
      }

      setEmail(user.email ?? "Signed-in user");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, reputation_score, report_count")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role) {
        setRole(profile.role as UserRole);
      }
      if (profile) {
        setReputationScore(profile.reputation_score ?? 0);
        setReportCount(profile.report_count ?? 0);
      }

      await Promise.all([
        loadReports("active", 1),
        loadFlags("active", 1),
      ]);

      setLoading(false);
    }

    void load();
  }, [loadFlags, loadReports, router]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function confirmDeleteReport() {
    if (!deleteTargetId) return;

    setDeleting(true);
    const res = await fetch(`/api/me/reports/${deleteTargetId}`, {
      method: "DELETE",
    });

    if (res.ok) {
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

  function handleReportsPageChange(page: number) {
    setReportsPage(page);
    void loadReports(reportView, page);
  }

  function handleFlagViewChange(view: UserFlagListView) {
    setFlagView(view);
    setFlagsPage(1);
    void loadFlags(view, 1);
  }

  function handleFlagsPageChange(page: number) {
    setFlagsPage(page);
    void loadFlags(flagView, page);
  }

  if (loading || !email) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-zinc-500">Loading your account…</p>
      </div>
    );
  }

  return (
    <>
      <AccountDashboard
        email={email}
        role={role}
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
        onReportsPageChange={handleReportsPageChange}
        onFlagViewChange={handleFlagViewChange}
        onFlagsPageChange={handleFlagsPageChange}
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
