"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminShell,
} from "@/components/admin/admin-dashboard-parts";
import {
  ADMIN_TABS,
  adminTabIndexForKey,
  type AdminPlace,
  type AdminReport,
  type AdminSession,
  type AdminTab,
  type AdminUser,
  type AdminUserUpdate,
} from "@/components/admin/admin-dashboard-model";
import { FlagsTab } from "@/components/admin/tabs/flags-tab";
import { OverviewTab } from "@/components/admin/tabs/overview-tab";
import { PlacesTab } from "@/components/admin/tabs/places-tab";
import { ReportsTab } from "@/components/admin/tabs/reports-tab";
import { UsersTab } from "@/components/admin/tabs/users-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildAdminPlacesSearchParams,
  parsePlaceSearchInput,
  type PlaceSearchCriteria,
} from "@/lib/admin/place-search";
import type { AdminFlagGroup } from "@/types/domain";
import { cn } from "@/lib/utils";

const ADMIN_HINTS_DISMISSED_KEY = "cobalt-admin-hints-dismissed";
const adminFetch: RequestInit = { cache: "no-store" };

function readAdminHintsDismissed() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ADMIN_HINTS_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export interface AdminDashboardInitialData {
  session: AdminSession;
  reports: AdminReport[];
  flagGroups: AdminFlagGroup[];
  activePlaceCount: number;
  users: AdminUser[];
}

export function AdminDashboard({
  initial,
}: {
  initial: AdminDashboardInitialData;
}) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [session, setSession] = useState<AdminSession | null>(initial.session);
  const [reports, setReports] = useState<AdminReport[]>(initial.reports);
  const [flagGroups, setFlagGroups] = useState<AdminFlagGroup[]>(
    initial.flagGroups,
  );
  const [places, setPlaces] = useState<AdminPlace[]>([]);
  const [placesTotal, setPlacesTotal] = useState(0);
  const [placePage, setPlacePage] = useState(1);
  const [placeSearchInputs, setPlaceSearchInputs] = useState({
    name: "",
    postalCode: "",
    addressLine1: "",
  });
  const [placeSearchCriteria, setPlaceSearchCriteria] =
    useState<PlaceSearchCriteria | null>(null);
  const [placeSearchError, setPlaceSearchError] = useState<string | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [activePlaceCount, setActivePlaceCount] = useState(
    initial.activePlaceCount,
  );
  const [users, setUsers] = useState<AdminUser[]>(initial.users);
  const [placeFilter, setPlaceFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [merging, setMerging] = useState(false);
  const [userLookupId, setUserLookupId] = useState("");
  const [userLookupError, setUserLookupError] = useState<string | null>(null);
  const [lookupUser, setLookupUser] = useState<AdminUser | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [hintsDismissed, setHintsDismissed] = useState(false);
  const [hintsExpanded, setHintsExpanded] = useState(false);

  const isAdmin = session?.role === "admin";
  const visibleTabs = useMemo(
    () => ADMIN_TABS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin],
  );

  const filteredPlaces = places;

  const stats = useMemo(
    () => ({
      openFlags: flagGroups.reduce((total, group) => total + group.flagCount, 0),
      activeReports: reports.filter(
        (report) =>
          report.status === "active" &&
          !report.reviewed_at &&
          (report.report_kind === "new_location" || report.report_kind === "error"),
      ).length,
      flaggedReports: reports.filter((report) => report.status === "flagged").length,
      activePlaces: activePlaceCount,
      users: users.length,
    }),
    [activePlaceCount, flagGroups, reports, users.length],
  );

  const refreshModerationQueues = useCallback(async () => {
    const [reportsRes, flagsRes] = await Promise.all([
      fetch("/api/admin/reports", adminFetch),
      fetch("/api/admin/flags", adminFetch),
    ]);

    if (reportsRes.ok) {
      const data = await reportsRes.json();
      setReports(data.reports ?? []);
    }

    if (flagsRes.ok) {
      const data = await flagsRes.json();
      setFlagGroups(data.flagGroups ?? []);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const sessionRes = await fetch("/api/admin/session", adminFetch);
    if (!sessionRes.ok) {
      const data = await sessionRes.json().catch(() => null);
      if (sessionRes.status === 401) {
        setError("Sign in required.");
      } else if (sessionRes.status === 403) {
        setError("Moderator access required.");
      } else {
        setError(data?.error ?? "Failed to load admin session.");
      }
      setLoading(false);
      return;
    }

    const sessionData = (await sessionRes.json()) as AdminSession;
    setSession(sessionData);

    const requests = [
      fetch("/api/admin/reports", adminFetch),
      fetch("/api/admin/flags", adminFetch),
      fetch("/api/admin/places?status=active&limit=1&page=1", adminFetch),
    ];

    if (sessionData.role === "admin") {
      requests.push(fetch("/api/admin/users?limit=100", adminFetch));
    }

    const responses = await Promise.all(requests);
    const [reportsRes, flagsRes, placesRes, usersRes] = responses;

    if (!reportsRes.ok || !flagsRes.ok || !placesRes.ok) {
      const failed = [reportsRes, flagsRes, placesRes].find((res) => !res.ok);
      const data = await failed?.json().catch(() => null);
      setError(data?.error ?? "Failed to load admin dashboard.");
      setLoading(false);
      return;
    }

    const reportsData = await reportsRes.json();
    const flagsData = await flagsRes.json();
    const placesCountData = await placesRes.json();

    setReports(reportsData.reports ?? []);
    setFlagGroups(flagsData.flagGroups ?? []);
    setActivePlaceCount(placesCountData.total ?? 0);
    setPlaces([]);
    setPlacesTotal(0);

    if (usersRes?.ok) {
      const usersData = await usersRes.json();
      setUsers(usersData.users ?? []);
    } else {
      setUsers([]);
    }

    setLoading(false);
  }, []);

  const loadPlaces = useCallback(async () => {
    if (!placeSearchCriteria) {
      setPlaces([]);
      setPlacesTotal(0);
      return;
    }

    setPlacesLoading(true);
    const params = buildAdminPlacesSearchParams(placeSearchCriteria, {
      page: placePage,
      limit: 10,
      status: placeFilter !== "all" ? placeFilter : undefined,
    });

    const res = await fetch(`/api/admin/places?${params.toString()}`, adminFetch);
    if (res.ok) {
      const data = await res.json();
      setPlaces(data.places ?? []);
      setPlacesTotal(data.total ?? 0);
    }
    setPlacesLoading(false);
  }, [placeFilter, placePage, placeSearchCriteria]);

  function submitPlaceSearch(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parsePlaceSearchInput(placeSearchInputs);
    if (!parsed.criteria) {
      setPlaceSearchError(parsed.error);
      return;
    }

    setPlaceSearchError(null);
    setPlacePage(1);
    setPlaceSearchCriteria(parsed.criteria);
  }

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setHintsDismissed(readAdminHintsDismissed()),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, []);

  function dismissAdminHints() {
    setHintsDismissed(true);
    setHintsExpanded(false);
    try {
      localStorage.setItem(ADMIN_HINTS_DISMISSED_KEY, "1");
    } catch {
      // ignore storage errors
    }
  }

  function openAdminHints() {
    setHintsExpanded(true);
    setTab("overview");
  }

  useEffect(() => {
    if (tab !== "places") return;
    const timeout = window.setTimeout(() => void loadPlaces(), 0);
    return () => window.clearTimeout(timeout);
  }, [tab, loadPlaces]);

  useEffect(() => {
    if (!session || isAdmin || tab !== "users") return;
    const timeout = window.setTimeout(() => setTab("overview"), 0);
    return () => window.clearTimeout(timeout);
  }, [session, isAdmin, tab]);

  async function searchUserById(e: React.FormEvent) {
    e.preventDefault();
    setUserLookupError(null);
    setLookupUser(null);
    const id = userLookupId.trim();
    if (!id) return;

    setLookupLoading(true);
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`);
    setLookupLoading(false);

    if (res.status === 404) {
      setUserLookupError("No user found for that UUID.");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setUserLookupError(data?.error ?? "User lookup failed.");
      return;
    }

    const data = await res.json();
    setLookupUser(data.user as AdminUser);
  }

  async function patchReport(
    id: string,
    status: AdminReport["status"],
    moderationReason?: string,
  ) {
    setActionError(null);
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, moderationReason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setActionError(data?.error ?? "Could not update report.");
      return;
    }

    await refreshModerationQueues();
  }

  async function approveReport(id: string) {
    setActionError(null);
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setActionError(data?.error ?? "Could not approve report.");
      return;
    }

    await refreshModerationQueues();
  }

  async function resolvePlaceFlags(
    placeId: string,
    status: "resolved" | "dismissed",
  ) {
    setActionError(null);
    const res = await fetch(`/api/admin/places/${placeId}/flags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setActionError(data?.error ?? "Could not update flags.");
      return;
    }

    await refreshModerationQueues();
  }

  async function patchPlace(id: string, updates: Record<string, unknown>) {
    setActionError(null);
    const res = await fetch(`/api/admin/places/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setActionError(data?.error ?? "Could not update place.");
      return;
    }
    const data = await res.json();
    setPlaces((current) =>
      current.map((place) =>
        place.id === id ? { ...place, ...data.place } : place,
      ),
    );
  }

  async function patchUser(
    id: string,
    updates: AdminUserUpdate,
  ): Promise<AdminUser | null> {
    setActionError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setActionError(data?.error ?? "Could not update user.");
      return null;
    }
    const data = await res.json();
    return data.profile as AdminUser;
  }

  async function mergePlaces(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setMerging(true);

    const res = await fetch("/api/admin/places/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourcePlaceId: mergeSourceId.trim(),
        targetPlaceId: mergeTargetId.trim(),
        reason: mergeReason.trim() || undefined,
      }),
    });

    setMerging(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setActionError(data?.error ?? "Could not merge places.");
      return;
    }

    setMergeSourceId("");
    setMergeTargetId("");
    setMergeReason("");
    await loadDashboard();
    if (tab === "places") {
      await loadPlaces();
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">Loading admin dashboard…</p>
        </div>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell>
        <div className="shrink-0">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        <div className="flex flex-1 flex-col items-start justify-center gap-4">
          <p className="text-red-600">{error}</p>
          <div className="flex gap-2">
            <Link href="/login?next=/admin">
              <Button>Sign in</Button>
            </Link>
            <Link href="/account">
              <Button variant="outline">Account</Button>
            </Link>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="shrink-0 space-y-4 border-b border-zinc-200 pb-4 pt-5 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase dark:text-cobalt-300">Community tools</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Moderation</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {session?.email ?? session?.username ?? "Moderator"}
              {" · "}
              <Badge variant="default">{session?.role}</Badge>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadDashboard()}>
            Refresh
          </Button>
        </div>

        {actionError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        ) : null}

        <div role="tablist" aria-label="Admin sections" className="flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          {visibleTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`admin-tab-${item.id}`}
              aria-controls={`admin-panel-${item.id}`}
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const tabs = Array.from(
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  ) ?? [],
                );
                const currentIndex = tabs.indexOf(event.currentTarget);
                const nextIndex = adminTabIndexForKey(
                  currentIndex,
                  tabs.length,
                  event.key as "ArrowLeft" | "ArrowRight" | "Home" | "End",
                );
                tabs[nextIndex]?.focus();
                tabs[nextIndex]?.click();
              }}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200",
                tab === item.id
                  ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white",
              )}
            >
              {item.label}
              {item.id === "reports" && stats.activeReports > 0 ? <span className="rounded bg-amber-100 px-1.5 text-[0.6875rem] text-amber-800 dark:bg-amber-950 dark:text-amber-200">{stats.activeReports}</span> : null}
              {item.id === "flags" && stats.openFlags > 0 ? <span className="rounded bg-amber-100 px-1.5 text-[0.6875rem] text-amber-800 dark:bg-amber-950 dark:text-amber-200">{stats.openFlags}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
        {tab === "overview" ? <OverviewTab stats={stats} isAdmin={isAdmin} showHints={Boolean((!hintsDismissed || hintsExpanded) && session)} onDismissHints={dismissAdminHints} /> : null}
        {tab === "reports" ? <ReportsTab reports={reports} onApprove={(id) => void approveReport(id)} onPatch={(id, status, reason) => void patchReport(id, status, reason)} /> : null}
        {tab === "flags" ? <FlagsTab flagGroups={flagGroups} onResolve={(placeId, status) => void resolvePlaceFlags(placeId, status)} /> : null}
        {tab === "places" ? (
          <PlacesTab
            places={filteredPlaces}
            total={placesTotal}
            page={placePage}
            loading={placesLoading}
            searchInputs={placeSearchInputs}
            searchCriteria={placeSearchCriteria}
            searchError={placeSearchError}
            filter={placeFilter}
            mergeInputs={{ sourceId: mergeSourceId, targetId: mergeTargetId, reason: mergeReason }}
            merging={merging}
            onSearchInputsChange={setPlaceSearchInputs}
            onSubmitSearch={submitPlaceSearch}
            onFilterChange={(value) => { setPlaceFilter(value); setPlacePage(1); }}
            onPageChange={setPlacePage}
            onPatchPlace={(id, updates) => void patchPlace(id, updates)}
            onMergeInputsChange={(inputs) => { setMergeSourceId(inputs.sourceId); setMergeTargetId(inputs.targetId); setMergeReason(inputs.reason); }}
            onSubmitMerge={(event) => void mergePlaces(event)}
          />
        ) : null}
        {tab === "users" && isAdmin ? (
          <UsersTab
            users={users}
            lookupUser={lookupUser}
            lookupId={userLookupId}
            lookupError={userLookupError}
            lookupLoading={lookupLoading}
            currentUserId={session?.id}
            onLookupIdChange={setUserLookupId}
            onLookup={(event) => void searchUserById(event)}
            onUserUpdated={(updated) => {
              setUsers((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
              if (lookupUser?.id === updated.id) setLookupUser(updated);
            }}
            onPatchUser={patchUser}
          />
        ) : null}
      </div>

      {hintsDismissed && !hintsExpanded ? (
        <div className="shrink-0 border-t border-zinc-200 py-3 text-center dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Need the action guide?{" "}
            <button
              type="button"
              onClick={openAdminHints}
              className="font-medium text-cobalt-600 hover:underline dark:text-cobalt-400"
            >
              Show guide
            </button>
          </p>
        </div>
      ) : null}
    </AdminShell>
  );
}
