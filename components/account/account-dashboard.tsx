"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatMultiplier } from "@/lib/utils";
import type { MultiplierReport } from "@/types/domain";

interface AccountDashboardProps {
  email: string;
  reports: MultiplierReport[];
  onSignOut: () => void;
  onDeleteReport: (id: string) => void;
}

export function AccountDashboard({
  email,
  reports,
  onSignOut,
  onDeleteReport,
}: AccountDashboardProps) {
  const activeReports = reports.filter((report) => report.status === "active");

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
              Track reports and contribute to the Cobalt merchant map.
            </p>
          </div>
          <Button variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Active reports
            </dt>
            <dd className="mt-1 text-2xl font-semibold">{activeReports.length}</dd>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Total submitted
            </dt>
            <dd className="mt-1 text-2xl font-semibold">{reports.length}</dd>
          </div>
          <div className="col-span-2 rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-3 sm:col-span-1 dark:border-zinc-700 dark:bg-zinc-900/80">
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
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">My reports</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Multiplier reports you&apos;ve submitted to the community.
        </p>

        {reports.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="py-8 text-center">
              <p className="text-zinc-600">No reports yet.</p>
              <Link href="/">
                <Button className="mt-4" variant="outline">
                  Browse the map
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-4 space-y-2">
            {reports.map((report) => (
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
                        {formatDate(report.transactionDate)} · {report.paymentContext}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={report.status === "active" ? "success" : "muted"}
                      >
                        {report.status}
                      </Badge>
                      {report.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteReport(report.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
