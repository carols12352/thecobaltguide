"use client";

import { Suspense } from "react";
import Link from "next/link";
import { SecuritySettings } from "@/components/account/security-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { isModeratorOrAbove } from "@/lib/auth/permissions";
import { formatStaffRoleLabel } from "@/lib/auth/role-label";
import {
  ACCOUNT_FLAGS_PAGE_SIZE,
  FLAG_REASON_LABELS,
  type UserFlagListView,
  userFlagStatusLabel,
} from "@/lib/flags/user-flag-state";
import { REPORT_KIND_LABELS } from "@/lib/reports/report-kind";
import {
  ACCOUNT_REPORTS_PAGE_SIZE,
  canUserRemoveReport,
  type UserReportListView,
  userReportStatusLabel,
} from "@/lib/reports/user-report-state";
import { ACCOUNT_RECENT_LIST_DAYS } from "@/lib/account/recent-list-window";
import {
  REPUTATION_DELTAS,
  REPUTATION_SUBMIT_FLOOR,
  canSubmitWithReputation,
} from "@/lib/reputation/scoring";
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
  const canContribute = canSubmitWithReputation(reputationScore);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase dark:text-cobalt-300">
              Account
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Profile</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/map" className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-3.5 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">Map</Link>
            <Link href="/submit" className="inline-flex h-10 items-center rounded-lg bg-cobalt-600 px-3.5 text-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-cobalt-700">Add merchant</Link>
            <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
          </div>
        </div>

        {isStaff ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cobalt-50 px-4 py-3 dark:bg-cobalt-950/30">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                {roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}
              </Badge>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">Community moderation access</p>
            </div>
            <Link
              href="/admin"
              className="text-sm font-medium text-cobalt-600 hover:underline dark:text-cobalt-400"
            >
              Open admin →
            </Link>
          </div>
        ) : null}

        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4 dark:border-zinc-700 dark:bg-zinc-700">
          <div className="bg-white px-4 py-4 dark:bg-zinc-900">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Reputation
            </dt>
            <dd className="mt-1 text-2xl font-semibold">{reputationScore}</dd>
          </div>
          <div className="bg-white px-4 py-4 dark:bg-zinc-900">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Live reports
            </dt>
            <dd className="mt-1 text-2xl font-semibold">{activeReportsTotal}</dd>
          </div>
          <div className="bg-white px-4 py-4 dark:bg-zinc-900">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Open flags
            </dt>
            <dd className="mt-1 text-2xl font-semibold">{activeFlagsTotal}</dd>
          </div>
          <div className="bg-white px-4 py-4 dark:bg-zinc-900">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              All reports
            </dt>
            <dd className="mt-1 text-2xl font-semibold">{reportCount}</dd>
          </div>
        </dl>
      </header>

        <details className="group mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 transition-colors duration-200 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden dark:hover:bg-zinc-800/60">
            <div>
              <p className="text-sm font-semibold">How reputation works</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Points reflect reviewed community contributions.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={cn("text-xs font-medium", canContribute ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300")}>
                {canContribute ? "Contribution enabled" : "Submissions paused"}
              </span>
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-zinc-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true">
                <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </summary>

          <div className="border-t border-zinc-200 px-4 py-5 dark:border-zinc-800">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold">Current effect</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Reputation records contribution outcomes. Below {REPUTATION_SUBMIT_FLOOR}, new reports and flags are paused. It does not currently change merchant multipliers, report weighting, or map ranking.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold">Future use</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Reputation may later support trust indicators or contribution privileges. Any new effect will be documented before it is introduced.
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <caption className="sr-only">Reputation point rules</caption>
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                    <th className="pb-2 pr-4 font-medium">Contribution</th>
                    <th className="pb-2 pr-4 font-medium">Positive outcome</th>
                    <th className="pb-2 font-medium">Negative outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  <tr><td className="py-3 pr-4 font-medium">Confirm or update</td><td className="py-3 pr-4 text-emerald-700 dark:text-emerald-400">+{REPUTATION_DELTAS.confirmSubmitted} when submitted</td><td className="py-3 text-zinc-600 dark:text-zinc-400">{REPUTATION_DELTAS.confirmSelfDeleted} removed by you · {REPUTATION_DELTAS.confirmRemovedByModerator} removed by staff</td></tr>
                  <tr><td className="py-3 pr-4 font-medium">Error report</td><td className="py-3 pr-4 text-emerald-700 dark:text-emerald-400">+{REPUTATION_DELTAS.errorApproved} when upheld</td><td className="py-3 text-zinc-600 dark:text-zinc-400">{REPUTATION_DELTAS.errorRejected} when rejected</td></tr>
                  <tr><td className="py-3 pr-4 font-medium">New merchant</td><td className="py-3 pr-4 text-emerald-700 dark:text-emerald-400">+{REPUTATION_DELTAS.newLocationApproved} when accepted</td><td className="py-3 text-zinc-600 dark:text-zinc-400">{REPUTATION_DELTAS.newLocationRejected} when rejected</td></tr>
                  <tr><td className="pt-3 pr-4 font-medium">Place flag</td><td className="pt-3 pr-4 text-emerald-700 dark:text-emerald-400">+{REPUTATION_DELTAS.flagResolved} when resolved</td><td className="pt-3 text-zinc-600 dark:text-zinc-400">{REPUTATION_DELTAS.flagDismissed} when dismissed</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>

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
              Activity from the last {ACCOUNT_RECENT_LIST_DAYS} days. Archive includes reviewed or removed reports.
            </p>
          </div>
          <div className="flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
            {(["active", "archive"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => onReportViewChange(view)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors duration-200",
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
                <Link href="/map">
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
                    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-[border-color,background-color] duration-200 hover:border-zinc-300 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
                        <div className="min-w-0">
                          <Link
                            href={`/place/${report.placeId}`}
                            className="font-medium text-cobalt-700 hover:underline dark:text-cobalt-300"
                          >
                            Open merchant
                          </Link>
                          <p className="text-sm text-zinc-500">
                            {formatMultiplier(report.multiplier)} ·{" "}
                            {REPORT_KIND_LABELS[report.reportKind]} ·{" "}
                            {formatDate(report.transactionDate)} ·{" "}
                            {report.paymentContext.replaceAll("_", " ")}
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
                    </div>
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
              Flags from the last {ACCOUNT_RECENT_LIST_DAYS} days. Archive includes resolved or dismissed items.
            </p>
          </div>
          <div className="flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
            {(["active", "archive"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => onFlagViewChange(view)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors duration-200",
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
                <Link href="/map">
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
                  <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-[border-color,background-color] duration-200 hover:border-zinc-300 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
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
                  </div>
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
