import Link from "next/link";
import { EmptyState } from "@/components/admin/admin-dashboard-parts";
import { formatAdminDate } from "@/components/admin/admin-dashboard-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatAdminFlagGroupHeadline } from "@/lib/flags/admin-flag-groups";
import { FLAG_REASON_LABELS } from "@/lib/flags/user-flag-state";
import type { AdminFlagGroup } from "@/types/domain";

export function FlagsTab({
  flagGroups,
  onResolve,
}: {
  flagGroups: AdminFlagGroup[];
  onResolve: (placeId: string, status: "resolved" | "dismissed") => void;
}) {
  return (
    <section id="admin-panel-flags" role="tabpanel" aria-labelledby="admin-tab-flags" className="space-y-3">
      {flagGroups.map((group) => (
        <Card key={group.placeId} className="shadow-none transition-colors duration-200 hover:border-zinc-300 dark:hover:border-zinc-700">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{group.placeName ?? "Unknown place"}</p>
                <p className="text-sm text-zinc-600">{group.placeCity ?? "Unknown city"} · {formatAdminFlagGroupHeadline(group)}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {group.reasons.map((reason) => <Badge key={reason} variant="warning">{FLAG_REASON_LABELS[reason] ?? reason}</Badge>)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <ul className="space-y-2 text-sm text-zinc-600">
              {group.flags.map((flag) => (
                <li key={flag.id} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50">
                  <p>
                    {FLAG_REASON_LABELS[flag.reason] ?? flag.reason} · {flag.reporter.username ?? "unknown"}
                    {flag.reporter.id !== "unknown" ? <> · <span className="font-mono text-xs">{flag.reporter.id}</span></> : null}
                    {" · "}{formatAdminDate(flag.createdAt)}
                  </p>
                  {flag.details ? <p className="mt-1 text-zinc-700 dark:text-zinc-300">{flag.details}</p> : null}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/places/${group.placeId}`}><Button size="sm" variant="outline">Open place</Button></Link>
              <Button size="sm" onClick={() => onResolve(group.placeId, "resolved")}>Resolve all</Button>
              <Button size="sm" variant="outline" onClick={() => onResolve(group.placeId, "dismissed")}>Dismiss all</Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {flagGroups.length === 0 ? <EmptyState message="No open flags." /> : null}
    </section>
  );
}
