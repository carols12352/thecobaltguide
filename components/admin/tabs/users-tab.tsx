import { AdminUserCard, EmptyState } from "@/components/admin/admin-dashboard-parts";
import type { AdminUser, AdminUserUpdate } from "@/components/admin/admin-dashboard-model";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UsersTab({
  users,
  lookupUser,
  lookupId,
  lookupError,
  lookupLoading,
  currentUserId,
  onLookupIdChange,
  onLookup,
  onUserUpdated,
  onPatchUser,
}: {
  users: AdminUser[];
  lookupUser: AdminUser | null;
  lookupId: string;
  lookupError: string | null;
  lookupLoading: boolean;
  currentUserId?: string;
  onLookupIdChange: (id: string) => void;
  onLookup: (event: React.FormEvent) => void;
  onUserUpdated: (user: AdminUser) => void;
  onPatchUser: (id: string, updates: AdminUserUpdate) => Promise<AdminUser | null>;
}) {
  return (
    <section id="admin-panel-users" role="tabpanel" aria-labelledby="admin-tab-users" className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Look up by UUID</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Paste a user UUID from reports or flags to manage their role and status.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onLookup} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="user-lookup-id">User UUID</Label>
              <Input id="user-lookup-id" value={lookupId} onChange={(event) => onLookupIdChange(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" spellCheck={false} className="font-mono text-sm" />
            </div>
            <Button type="submit" disabled={lookupLoading}>{lookupLoading ? "Looking up…" : "Look up"}</Button>
          </form>
          {lookupError ? <p className="mt-3 text-sm text-red-600">{lookupError}</p> : null}
        </CardContent>
      </Card>

      {lookupUser ? <AdminUserCard user={lookupUser} currentUserId={currentUserId} onUpdate={onUserUpdated} onPatch={onPatchUser} /> : null}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Recent users</h2>
        {users.map((user) => <AdminUserCard key={user.id} user={user} currentUserId={currentUserId} onUpdate={onUserUpdated} onPatch={onPatchUser} />)}
        {users.length === 0 ? <EmptyState message="No users loaded." /> : null}
      </div>
    </section>
  );
}
