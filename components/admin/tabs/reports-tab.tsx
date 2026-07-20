import Link from "next/link";
import { EmptyState } from "@/components/admin/admin-dashboard-parts";
import {
  PAYMENT_CONTEXT_LABELS,
  formatAdminDate,
  reportStatusVariant,
  type AdminReport,
} from "@/components/admin/admin-dashboard-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { REPORT_KIND_LABELS } from "@/lib/reports/report-kind";

export function ReportsTab({
  reports,
  onApprove,
  onPatch,
}: {
  reports: AdminReport[];
  onApprove: (id: string) => void;
  onPatch: (id: string, status: AdminReport["status"], reason?: string) => void;
}) {
  return (
    <section id="admin-panel-reports" role="tabpanel" aria-labelledby="admin-tab-reports" className="space-y-3">
      {reports.map((report) => (
        <Card key={report.id} className="shadow-none transition-colors duration-200 hover:border-zinc-300 dark:hover:border-zinc-700">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{report.places?.name ?? "Unknown place"}</p>
                <Badge variant={reportStatusVariant(report.status)}>{report.status}</Badge>
                <Badge variant="muted">{REPORT_KIND_LABELS[report.report_kind]}</Badge>
                <Badge variant="default">{report.multiplier}x</Badge>
              </div>
              <p className="text-sm text-zinc-600">
                {report.places?.city}, {report.places?.province} · {PAYMENT_CONTEXT_LABELS[report.payment_context] ?? report.payment_context} · {formatAdminDate(report.transaction_date)}
              </p>
              <p className="text-xs text-zinc-500">
                Reporter: {report.reporter?.username ?? "unknown"}
                {report.reporter?.id ? <> · <span className="font-mono">{report.reporter.id}</span></> : null}
                {" · "}Submitted {formatAdminDate(report.created_at)}
              </p>
              {report.notes ? <p className="text-sm text-zinc-600">{report.notes}</p> : null}
              {report.moderation_reason ? <p className="text-xs text-amber-700">Moderation: {report.moderation_reason}</p> : null}
              {report.places?.id ? <Link href={`/admin/places/${report.places.id}`} className="text-sm font-medium text-cobalt-600 hover:underline">Open place →</Link> : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <Button size="sm" onClick={() => onApprove(report.id)}>Approve</Button>
              <div className="w-[5.75rem]">
                {report.status === "flagged" ? (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => onPatch(report.id, "active")}>Restore</Button>
                ) : (
                  <Button size="sm" variant="outline" className="w-full" disabled={report.status === "removed"} onClick={() => onPatch(report.id, "flagged", "Needs review")}>Flag</Button>
                )}
              </div>
              <Button size="sm" variant="destructive" disabled={report.status === "removed"} onClick={() => onPatch(report.id, "removed", "Admin removal")}>Remove</Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {reports.length === 0 ? <EmptyState message="No reports need review." /> : null}
    </section>
  );
}
