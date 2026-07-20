import { AdminHintsCard, StatCard } from "@/components/admin/admin-dashboard-parts";
import { cn } from "@/lib/utils";

export interface OverviewStats {
  openFlags: number;
  activeReports: number;
  flaggedReports: number;
  activePlaces: number;
  users: number;
}

export function OverviewTab({
  stats,
  isAdmin,
  showHints,
  onDismissHints,
}: {
  stats: OverviewStats;
  isAdmin: boolean;
  showHints: boolean;
  onDismissHints: () => void;
}) {
  return (
    <div id="admin-panel-overview" role="tabpanel" aria-labelledby="admin-tab-overview" className="space-y-5">
      <section aria-labelledby="queue-summary-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="queue-summary-heading" className="text-sm font-semibold">Queue summary</h2>
          <p className="text-xs text-zinc-500">Current workspace</p>
        </div>
        <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800", isAdmin ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
          <StatCard label="Open flags" value={stats.openFlags} />
          <StatCard label="Review queue" value={stats.activeReports} />
          <StatCard label="Flagged" value={stats.flaggedReports} />
          <StatCard label="Places" value={stats.activePlaces} />
          {isAdmin ? <StatCard label="Users" value={stats.users} className="col-span-2 sm:col-span-1" /> : null}
        </dl>
      </section>
      {showHints ? <AdminHintsCard isAdmin={isAdmin} onDismiss={onDismissHints} /> : null}
    </div>
  );
}
