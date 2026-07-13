"use client";

import { Suspense } from "react";
import Link from "next/link";
import { SecuritySettings } from "@/components/account/security-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { isModeratorOrAbove } from "@/lib/auth/permissions";
import { formatStaffRoleLabel, staffRoleArticle } from "@/lib/auth/role-label";
import {
  ACCOUNT_FLAGS_PAGE_SIZE,
  FLAG_REASON_LABELS,
  type UserFlagListView,
  userFlagStatusLabel,
} from "@/lib/flags/user-flag-state";
import { REPUTATION_HINT } from "@/lib/reputation/scoring";
import { REPORT_KIND_LABELS } from "@/lib/reports/report-kind";
import {
  ACCOUNT_REPORTS_PAGE_SIZE,
  canUserRemoveReport,
  type UserReportListView,
  userReportStatusLabel,
} from "@/lib/reports/user-report-state";
import { ACCOUNT_RECENT_LIST_DAYS } from "@/lib/account/recent-list-window";
import { formatDate, formatMultiplier } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { MultiplierReport, UserPlaceFlag, UserRole } from "@/types/domain";

interface AccountDashboardProps {
  email: string;
  role: UserRole;
  reputationScore: number;
  reportCount: number;
  activeReportsTotal: number;
  activeFlagsTotal: number;
  reports: MultiplierReport[];
  reportsTotal: number;
  reportsPage: number;
  reportView: UserReportListView;
  reportsLoading: boolean;
  flags: UserPlaceFlag[];
  flagsTotal: number;
  flagsPage: number;
  flagView: UserFlagListView;
  flagsLoading: boolean;
  onReportViewChange: (view: UserReportListView) => void;
  onReportsPageChange: (page: number) => void;
  onFlagViewChange: (view: UserFlagListView) => void;
  onFlagsPageChange: (page: number) => void;
  onSignOut: () => void;
  onDeleteReport: (id: string) => void;
}

function reportBadgeVariant(
  report: MultiplierReport,
): "success" | "warning" | "muted" {
  if (report.status === "removed") return "muted";
  if (report.status === "flagged") return "warning";
  if (report.reviewedBy) return "success";
  if (report.reportKind === "error" || report.reportKind === "new_location") {
    return "warning";
  }
  return "success";
}

function flagBadgeVariant(
  flag: UserPlaceFlag,
): "success" | "warning" | "muted" {
  if (flag.status === "open") return "warning";
  if (flag.status === "resolved") return "success";
  return "muted";
}

export function AccountDashboard({
  email,
  role,
  reputationScore,
  reportCount,
  activeReportsTotal,
  activeFlagsTotal,
  reports,
  reportsTotal,
  reportsPage,
  reportView,
  reportsLoading,
  flags,
  flagsTotal,
  flagsPage,
  flagView,
  flagsLoading,
  onReportViewChange,
  onReportsPageChange,
  onFlagViewChange,
  onFlagsPageChange,
  onSignOut,
  onDeleteReport,
}: AccountDashboardProps) {
  const isStaff = isModeratorOrAbove(role);
  const roleLabel = formatStaffRoleLabel(role);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-cobalt-50 to-white p-6 dark:border-zinc-800 dark:from-cobalt-950/30 dark:to-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-cobalt-700 dark:text-cobalt-300">
              Your account
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{email}</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Track reports, flags, and contribute to the Cobalt merchant map.
            </p>
          </div>
          <Button variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
        </div>

        {isStaff ? (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-cobalt-200 bg-white/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-cobalt-900 dark:bg-zinc-950/60">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                {roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}
              </Badge>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                You are {staffRoleArticle(role)} {roleLabel}.
              </p>
            </div>
            <Link
              href="/admin"
              className="text-sm font-medium text-cobalt-600 hover:underline dark:text-cobalt-400"
            >
              Go to admin →
            </Link>
          </div>
        ) : null}

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Reputation
            </dt>
            <dd className="mt-1 text-2xl font-semibold">{reputationScore}</dd>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Active reports ({ACCOUNT_RECENT_LIST_DAYS}d)
            </dt>
            <dd className="mt-1 text-2xl font-semibold">{activeReportsTotal}</dd>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Open flags ({ACCOUNT_RECENT_LIST_DAYS}d)
            </dt>
            <dd className="mt-1 text-2xl font-semibold">{activeFlagsTotal}</dd>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Total submitted
            </dt>
            <dd className="mt-1 text-2xl font-semibold">{reportCount}</dd>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Quick links
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2 text-sm">
              <Link href="/" className="font-medium text-cobalt-600 hover:underline">
                Map
              </Link>
              <Link href="/submit" className="font-medium text-cobalt-600 hover:underline">
                Add merchant
              </Link>
            </dd>
          </div>
        </dl>

        <p className="mt-4 rounded-xl border border-cobalt-100 bg-cobalt-50/70 px-4 py-3 text-sm text-cobalt-900 dark:border-cobalt-900 dark:bg-cobalt-950/30 dark:text-cobalt-100">
          {REPUTATION_HINT}
        </p>
      </div>

      <section className="mt-8">
        <Suspense
          fallback={
            <p className="text-sm text-zinc-500">Loading security settings…</p>
          }
        >
          <SecuritySettings />
        </Suspense>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">My reports</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Showing reports from the last {ACCOUNT_RECENT_LIST_DAYS} days.
              Active reports are still live on the map. Archived reports were
              reviewed or removed by moderators.
            </p>
          </div>
          <div className="flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
            {(["active", "archive"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => onReportViewChange(view)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  reportView === view
                    ? "bg-cobalt-100 text-cobalt-800 dark:bg-cobalt-900/40 dark:text-cobalt-200"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                )}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {reports.length === 0 && !reportsLoading ? (
          <Card className="mt-4">
            <CardContent className="py-8 text-center">
              <p className="text-zinc-600">
                {reportView === "active"
                  ? `No active reports in the last ${ACCOUNT_RECENT_LIST_DAYS} days.`
                  : `No archived reports in the last ${ACCOUNT_RECENT_LIST_DAYS} days.`}
              </p>
              {reportView === "active" ? (
                <Link href="/">
                  <Button className="mt-4" variant="outline">
                    Browse the map
                  </Button>
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 space-y-3">
            <ul className="space-y-2">
              {reports.map((report) => {
                const ownedReport = {
                  ...report,
                  reviewedAt: report.reviewedAt ?? null,
                  reviewedBy: report.reviewedBy ?? null,
                };
                const removable = canUserRemoveReport(ownedReport);

                return (
                  <li key={report.id}>
                    <Card>
                      <CardContent className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <Link
                            href={`/place/${report.placeId}`}
                            className="font-medium text-cobalt-700 hover:underline dark:text-cobalt-300"
                          >
                            View merchant
                          </Link>
                          <p className="text-sm text-zinc-500">
                            {formatMultiplier(report.multiplier)} ·{" "}
                            {REPORT_KIND_LABELS[report.reportKind]} ·{" "}
                            {formatDate(report.transactionDate)} ·{" "}
                            {report.paymentContext}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={reportBadgeVariant(ownedReport)}>
                            {userReportStatusLabel(ownedReport)}
                          </Badge>
                          {removable ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteReport(report.id)}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>

            {reportsTotal > ACCOUNT_REPORTS_PAGE_SIZE ? (
              <PaginationBar
                page={reportsPage}
                total={reportsTotal}
                pageSize={ACCOUNT_REPORTS_PAGE_SIZE}
                itemLabel="reports"
                loading={reportsLoading}
                compact
                onPageChange={onReportsPageChange}
              />
            ) : null}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">My flags</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Showing flags from the last {ACCOUNT_RECENT_LIST_DAYS} days. Open
              flags are still in the moderation queue. Archived flags were
              resolved or dismissed by moderators.
            </p>
          </div>
          <div className="flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
            {(["active", "archive"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => onFlagViewChange(view)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  flagView === view
                    ? "bg-cobalt-100 text-cobalt-800 dark:bg-cobalt-900/40 dark:text-cobalt-200"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                )}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {flags.length === 0 && !flagsLoading ? (
          <Card className="mt-4">
            <CardContent className="py-8 text-center">
              <p className="text-zinc-600">
                {flagView === "active"
                  ? `No open flags in the last ${ACCOUNT_RECENT_LIST_DAYS} days.`
                  : `No archived flags in the last ${ACCOUNT_RECENT_LIST_DAYS} days.`}
              </p>
              {flagView === "active" ? (
                <Link href="/">
                  <Button className="mt-4" variant="outline">
                    Browse the map
                  </Button>
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 space-y-3">
            <ul className="space-y-2">
              {flags.map((flag) => (
                <li key={flag.id}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link
                          href={`/place/${flag.placeId}`}
                          className="font-medium text-cobalt-700 hover:underline dark:text-cobalt-300"
                        >
                          {flag.placeName ?? "View merchant"}
                        </Link>
                        <p className="text-sm text-zinc-500">
                          {FLAG_REASON_LABELS[flag.reason]} ·{" "}
                          {formatDate(flag.createdAt.split("T")[0] ?? flag.createdAt)}
                          {flag.placeCity && flag.placeProvince
                            ? ` · ${flag.placeCity}, ${flag.placeProvince}`
                            : ""}
                        </p>
                        {flag.details ? (
                          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {flag.details}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant={flagBadgeVariant(flag)} className="shrink-0">
                        {userFlagStatusLabel(flag)}
                      </Badge>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>

            {flagsTotal > ACCOUNT_FLAGS_PAGE_SIZE ? (
              <PaginationBar
                page={flagsPage}
                total={flagsTotal}
                pageSize={ACCOUNT_FLAGS_PAGE_SIZE}
                itemLabel="flags"
                loading={flagsLoading}
                compact
                onPageChange={onFlagsPageChange}
              />
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
