"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  AdminUser,
  AdminUserUpdate,
} from "@/components/admin/admin-dashboard-model";
import { cn } from "@/lib/utils";

export function AdminUserCard({
  user,
  currentUserId,
  onUpdate,
  onPatch,
}: {
  user: AdminUser;
  currentUserId?: string;
  onUpdate: (user: AdminUser) => void;
  onPatch: (id: string, updates: AdminUserUpdate) => Promise<AdminUser | null>;
}) {
  const isSelf = user.id === currentUserId;
  const [reputationDraft, setReputationDraft] = useState({
    sourceScore: user.reputation_score,
    value: String(user.reputation_score),
  });
  const [savingReputation, setSavingReputation] = useState(false);
  const reputationDraftValue =
    reputationDraft.sourceScore === user.reputation_score
      ? reputationDraft.value
      : String(user.reputation_score);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{user.username ?? "Unnamed user"}</p>
            <Badge variant={user.status === "active" ? "success" : "danger"}>
              {user.status}
            </Badge>
            <Badge variant="muted">{user.role}</Badge>
            {isSelf ? <Badge variant="default">You</Badge> : null}
          </div>
          <p className="font-mono text-xs text-zinc-500 break-all">{user.id}</p>
          <p className="text-sm text-zinc-600">
            {user.report_count} reports · reputation {user.reputation_score}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`rep-${user.id}`} className="text-xs">
              Reputation
            </Label>
            <Input
              id={`rep-${user.id}`}
              type="number"
              className="w-28"
              value={reputationDraftValue}
              onChange={(event) =>
                setReputationDraft({
                  sourceScore: user.reputation_score,
                  value: event.target.value,
                })
              }
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={savingReputation}
            onClick={async () => {
              const parsed = Number.parseInt(reputationDraftValue, 10);
              if (Number.isNaN(parsed)) return;
              setSavingReputation(true);
              const updated = await onPatch(user.id, { reputationScore: parsed });
              setSavingReputation(false);
              if (updated) {
                onUpdate(updated);
                setReputationDraft({
                  sourceScore: updated.reputation_score,
                  value: String(updated.reputation_score),
                });
              }
            }}
          >
            {savingReputation ? "Saving…" : "Save rep"}
          </Button>
          <Select
            value={user.role}
            disabled={isSelf}
            onChange={async (event) => {
              const updated = await onPatch(user.id, {
                role: event.target.value as AdminUser["role"],
              });
              if (updated) onUpdate(updated);
            }}
          >
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </Select>
          {user.status === "active" ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={isSelf}
              onClick={async () => {
                const updated = await onPatch(user.id, { status: "suspended" });
                if (updated) onUpdate(updated);
              }}
            >
              Suspend
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const updated = await onPatch(user.id, { status: "active" });
                if (updated) onUpdate(updated);
              }}
            >
              Reactivate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminHintsCard({
  isAdmin,
  onDismiss,
}: {
  isAdmin: boolean;
  onDismiss: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Moderation guide
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            New-location and error reports enter the review queue. Routine confirmations publish automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Dismiss admin hints"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 md:grid-cols-3">
          <HintsSection title="Review queue">
            <div className="space-y-1">
              <HintLine action="New location" description="First report for a submitted place." />
              <HintLine action="Error" description="A user disputes existing data." />
            </div>
          </HintsSection>
          <HintsSection title="Report actions">
            <div className="space-y-1">
              <HintLine action="Approve" description="Stays live; leaves the queue." />
              <HintLine action="Flag" description="Keeps it in review." />
              <HintLine action="Remove" description="Hides from the public map." />
            </div>
          </HintsSection>
          <HintsSection title="Records">
            <div className="space-y-1">
              <HintLine action="Resolve" description="Issue handled; closes place flags." />
              <HintLine action="Dismiss" description="No action; closes place flags." />
              <HintLine action="Places" description="Find and maintain merchant records." />
              {isAdmin ? (
                <HintLine action="Users" description="Manage roles, status, and reputation." />
              ) : null}
            </div>
          </HintsSection>
        </div>
      </CardContent>
    </Card>
  );
}

function HintsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function HintLine({ action, description }: { action: string; description: string }) {
  return (
    <div className="py-1.5 text-sm leading-relaxed">
      <span className="font-medium text-zinc-900 dark:text-zinc-100">{action}</span>
      <span className="text-zinc-500 dark:text-zinc-400"> — {description}</span>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden px-4 sm:px-6">
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("bg-white px-4 py-4 dark:bg-zinc-900", className)}>
      <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 px-5 py-10 text-center dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nothing here</p>
      <p className="mt-1 text-sm text-zinc-500">{message}</p>
    </div>
  );
}
