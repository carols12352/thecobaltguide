"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PlacesPagination, PLACES_PAGE_SIZE } from "@/components/admin/places-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getCategoryLabel } from "@/config/categories";
import { REPORT_KIND_LABELS } from "@/lib/reports/report-kind";
import { cn } from "@/lib/utils";

type AdminTab = "overview" | "reports" | "flags" | "places" | "users";

interface AdminSession {
  id: string;
  email: string | null;
  username: string | null;
  role: "user" | "moderator" | "admin";
}

interface AdminReport {
  id: string;
  multiplier: string;
  transaction_date: string;
  payment_context: string;
  notes: string | null;
  status: "active" | "removed" | "flagged";
  report_kind: "new_location" | "error" | "update" | "confirm";
  moderation_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  place_id: string;
  places: { id: string; name: string; city: string; province: string } | null;
  reporter: { id: string; username: string | null } | null;
}

interface AdminFlag {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  place_id: string;
  places: { id: string; name: string; city: string } | null;
  reporter: { id: string; username: string | null } | null;
}

interface AdminPlace {
  id: string;
  name: string;
  address_line1: string | null;
  city: string;
  province: string;
  postal_code: string | null;
  category: string;
  status: "active" | "permanently_closed" | "merged";
  created_at: string;
}

interface AdminUser {
  id: string;
  username: string | null;
  role: "user" | "moderator" | "admin";
  status: "active" | "suspended";
  report_count: number;
  reputation_score: number;
  created_at: string;
}

const FLAG_REASON_LABELS: Record<string, string> = {
  duplicate: "Duplicate",
  wrong_address: "Wrong address",
  permanently_closed: "Permanently closed",
  does_not_accept_amex: "Does not accept Amex",
  incorrect_category: "Incorrect category",
  other: "Other",
};

const PAYMENT_CONTEXT_LABELS: Record<string, string> = {
  in_store: "In store",
  online: "Online",
  gas_pump: "Gas pump",
  delivery: "Delivery",
  other: "Other",
};

const TABS: { id: AdminTab; label: string; adminOnly?: boolean }[] = [
  { id: "overview", label: "Overview" },
  { id: "reports", label: "Reports" },
  { id: "flags", label: "Flags" },
  { id: "places", label: "Places" },
  { id: "users", label: "Users", adminOnly: true },
];

const ADMIN_HINTS_DISMISSED_KEY = "cobalt-admin-hints-dismissed";
const adminFetch: RequestInit = { cache: "no-store" };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function reportStatusVariant(
  status: AdminReport["status"],
): "success" | "warning" | "danger" | "muted" {
  if (status === "active") return "success";
  if (status === "flagged") return "warning";
  return "muted";
}

function placeStatusVariant(
  status: AdminPlace["status"],
): "success" | "warning" | "muted" {
  if (status === "active") return "success";
  if (status === "permanently_closed") return "warning";
  return "muted";
}

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [flags, setFlags] = useState<AdminFlag[]>([]);
  const [places, setPlaces] = useState<AdminPlace[]>([]);
  const [placesTotal, setPlacesTotal] = useState(0);
  const [placePage, setPlacePage] = useState(1);
  const [placeSearchInput, setPlaceSearchInput] = useState("");
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const [placesLoading, setPlacesLoading] = useState(false);
  const [activePlaceCount, setActivePlaceCount] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [placeFilter, setPlaceFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
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
  const moderatorName =
    session?.username ?? session?.email?.split("@")[0] ?? "moderator";

  const visibleTabs = useMemo(
    () => TABS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin],
  );

  const filteredPlaces = places;

  const stats = useMemo(
    () => ({
      openFlags: flags.length,
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
    [activePlaceCount, flags.length, reports, users.length],
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
      setFlags(data.flags ?? []);
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
    setFlags(flagsData.flags ?? []);
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
    setPlacesLoading(true);
    const params = new URLSearchParams({
      page: String(placePage),
      limit: "10",
    });
    if (placeFilter !== "all") {
      params.set("status", placeFilter);
    }
    if (placeSearchQuery) {
      params.set("q", placeSearchQuery);
    }

    const res = await fetch(`/api/admin/places?${params.toString()}`, adminFetch);
    if (res.ok) {
      const data = await res.json();
      setPlaces(data.places ?? []);
      setPlacesTotal(data.total ?? 0);
    }
    setPlacesLoading(false);
  }, [placeFilter, placePage, placeSearchQuery]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    try {
      setHintsDismissed(localStorage.getItem(ADMIN_HINTS_DISMISSED_KEY) === "1");
    } catch {
      setHintsDismissed(false);
    }
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
    void loadPlaces();
  }, [tab, loadPlaces]);

  useEffect(() => {
    if (session && !isAdmin && tab === "users") {
      setTab("overview");
    }
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

  async function patchFlag(id: string, status: "resolved" | "dismissed") {
    setActionError(null);
    const res = await fetch(`/api/admin/flags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setActionError(data?.error ?? "Could not update flag.");
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
    updates: { role?: AdminUser["role"]; status?: AdminUser["status"] },
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
      <div className="shrink-0 space-y-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Signed in as {session?.email ?? session?.username ?? "moderator"}
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

        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === item.id
                  ? "bg-cobalt-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
        {tab === "overview" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open flags" value={stats.openFlags} />
          <StatCard label="Needs review" value={stats.activeReports} />
          <StatCard label="Flagged reports" value={stats.flaggedReports} />
          <StatCard label="Active places" value={stats.activePlaces} />
          {isAdmin ? <StatCard label="Users" value={stats.users} className="sm:col-span-2 lg:col-span-1" /> : null}
        </div>
            {(!hintsDismissed || hintsExpanded) && session ? (
              <AdminHintsCard
                name={moderatorName}
                isAdmin={isAdmin}
                onDismiss={dismissAdminHints}
              />
            ) : null}
          </div>
      ) : null}

      {tab === "reports" ? (
        <section className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {report.places?.name ?? "Unknown place"}
                    </p>
                    <Badge variant={reportStatusVariant(report.status)}>
                      {report.status}
                    </Badge>
                    <Badge variant="muted">
                      {REPORT_KIND_LABELS[report.report_kind]}
                    </Badge>
                    <Badge variant="default">{report.multiplier}x</Badge>
                  </div>
                  <p className="text-sm text-zinc-600">
                    {report.places?.city}, {report.places?.province} ·{" "}
                    {PAYMENT_CONTEXT_LABELS[report.payment_context] ??
                      report.payment_context}{" "}
                    · {formatDate(report.transaction_date)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Reported by {report.reporter?.username ?? "unknown"}
                    {report.reporter?.id ? (
                      <>
                        {" · "}
                        <span className="font-mono">{report.reporter.id}</span>
                      </>
                    ) : null}{" "}
                    on {formatDate(report.created_at)}
                  </p>
                  {report.notes ? (
                    <p className="text-sm text-zinc-600">{report.notes}</p>
                  ) : null}
                  {report.moderation_reason ? (
                    <p className="text-xs text-amber-700">
                      Moderation: {report.moderation_reason}
                    </p>
                  ) : null}
                  {report.places?.id ? (
                    <Link
                      href={`/admin/places/${report.places.id}`}
                      className="text-sm font-medium text-cobalt-600 hover:underline"
                    >
                      Moderator view
                    </Link>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <Button
                    size="sm"
                    onClick={() => void approveReport(report.id)}
                  >
                    Approve
                  </Button>
                  <div className="w-[5.75rem]">
                    {report.status === "flagged" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => void patchReport(report.id, "active")}
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={report.status === "removed"}
                        onClick={() =>
                          void patchReport(report.id, "flagged", "Needs review")
                        }
                      >
                        Flag
                      </Button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={report.status === "removed"}
                    onClick={() =>
                      void patchReport(report.id, "removed", "Admin removal")
                    }
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {reports.length === 0 ? (
            <EmptyState message="No reports need review." />
          ) : null}
        </section>
      ) : null}

      {tab === "flags" ? (
        <section className="space-y-3">
          {flags.map((flag) => (
            <Card key={flag.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {flag.places?.name ?? "Unknown place"}
                  </p>
                  <Badge variant="warning">
                    {FLAG_REASON_LABELS[flag.reason] ?? flag.reason}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="text-sm text-zinc-600">
                  {flag.places?.city ?? "Unknown city"} · flagged by{" "}
                  {flag.reporter?.username ?? "unknown"}
                  {flag.reporter?.id ? (
                    <>
                      {" · "}
                      <span className="font-mono text-xs">{flag.reporter.id}</span>
                    </>
                  ) : null}{" "}
                  · {formatDate(flag.created_at)}
                </p>
                {flag.details ? (
                  <p className="text-sm text-zinc-700">{flag.details}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {flag.places?.id ? (
                    <Link href={`/admin/places/${flag.places.id}`}>
                      <Button size="sm" variant="outline">
                        Moderator view
                      </Button>
                    </Link>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => void patchFlag(flag.id, "resolved")}
                  >
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void patchFlag(flag.id, "dismissed")}
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {flags.length === 0 ? (
            <EmptyState message="No open flags." />
          ) : null}
        </section>
      ) : null}

      {tab === "places" ? (
        <section className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPlacePage(1);
              setPlaceSearchQuery(placeSearchInput.trim());
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="place-search">Search places</Label>
              <Input
                id="place-search"
                value={placeSearchInput}
                onChange={(e) => setPlaceSearchInput(e.target.value)}
                placeholder="Name, postal code, address, or UUID"
                spellCheck={false}
              />
            </div>
            <Button type="submit" disabled={placesLoading}>
              {placesLoading ? "Searching…" : "Search"}
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="place-filter">Filter</Label>
            <Select
              id="place-filter"
              value={placeFilter}
              onChange={(e) => {
                setPlaceFilter(e.target.value);
                setPlacePage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="permanently_closed">Permanently closed</option>
              <option value="merged">Merged</option>
            </Select>
          </div>

          {placesTotal > 0 ? (
            <PlacesPagination
              page={placePage}
              total={placesTotal}
              loading={placesLoading}
              onPageChange={setPlacePage}
            />
          ) : null}

          <div className="space-y-3">
            {filteredPlaces.map((place) => (
              <Card key={place.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{place.name}</p>
                      <Badge variant={placeStatusVariant(place.status)}>
                        {place.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    {place.address_line1 ? (
                      <p className="text-sm text-zinc-600">{place.address_line1}</p>
                    ) : null}
                    <p className="text-sm text-zinc-600">
                      {place.city}, {place.province}
                      {place.postal_code ? ` · ${place.postal_code}` : ""} ·{" "}
                      {getCategoryLabel(place.category)}
                    </p>
                    <p className="font-mono text-xs text-zinc-500">{place.id}</p>
                    <Link
                      href={`/admin/places/${place.id}`}
                      className="text-sm font-medium text-cobalt-600 hover:underline"
                    >
                      Moderator view
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {place.status !== "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void patchPlace(place.id, { status: "active" })
                        }
                      >
                        Mark active
                      </Button>
                    ) : null}
                    {place.status !== "permanently_closed" ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          void patchPlace(place.id, {
                            status: "permanently_closed",
                          })
                        }
                      >
                        Mark closed
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredPlaces.length === 0 && !placesLoading ? (
              <EmptyState message="No places match this search." />
            ) : null}
            {placesLoading && filteredPlaces.length === 0 ? (
              <p className="text-sm text-zinc-600">Loading places…</p>
            ) : null}
          </div>

          {placesTotal > PLACES_PAGE_SIZE ? (
            <PlacesPagination
              page={placePage}
              total={placesTotal}
              loading={placesLoading}
              onPageChange={setPlacePage}
            />
          ) : null}

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Merge duplicate places</h2>
              <p className="text-sm text-zinc-600">
                Moves reports from the source place to the target, then marks the
                source as merged.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void mergePlaces(e)} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="merge-source">Source place ID</Label>
                    <Input
                      id="merge-source"
                      value={mergeSourceId}
                      onChange={(e) => setMergeSourceId(e.target.value)}
                      placeholder="Duplicate to remove"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="merge-target">Target place ID</Label>
                    <Input
                      id="merge-target"
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      placeholder="Place to keep"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="merge-reason">Reason (optional)</Label>
                  <Input
                    id="merge-reason"
                    value={mergeReason}
                    onChange={(e) => setMergeReason(e.target.value)}
                    placeholder="Duplicate listing"
                  />
                </div>
                <Button type="submit" disabled={merging}>
                  {merging ? "Merging…" : "Merge places"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {tab === "users" && isAdmin ? (
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Look up by UUID</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Paste a user UUID from reports or flags to manage their role and
                status.
              </p>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => void searchUserById(e)}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="user-lookup-id">User UUID</Label>
                  <Input
                    id="user-lookup-id"
                    value={userLookupId}
                    onChange={(e) => setUserLookupId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    spellCheck={false}
                    className="font-mono text-sm"
                  />
                </div>
                <Button type="submit" disabled={lookupLoading}>
                  {lookupLoading ? "Looking up…" : "Look up"}
                </Button>
              </form>
              {userLookupError ? (
                <p className="mt-3 text-sm text-red-600">{userLookupError}</p>
              ) : null}
            </CardContent>
          </Card>

          {lookupUser ? (
            <AdminUserCard
              user={lookupUser}
              currentUserId={session?.id}
              onUpdate={(updated) => {
                setLookupUser(updated);
                setUsers((current) =>
                  current.map((entry) =>
                    entry.id === updated.id ? updated : entry,
                  ),
                );
              }}
              onPatch={patchUser}
            />
          ) : null}

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Recent users
            </h2>
            {users.map((user) => (
              <AdminUserCard
                key={user.id}
                user={user}
                currentUserId={session?.id}
                onUpdate={(updated) => {
                  setUsers((current) =>
                    current.map((entry) =>
                      entry.id === updated.id ? updated : entry,
                    ),
                  );
                  if (lookupUser?.id === updated.id) {
                    setLookupUser(updated);
                  }
                }}
                onPatch={patchUser}
              />
            ))}
            {users.length === 0 ? (
              <EmptyState message="No users loaded." />
            ) : null}
          </div>
        </section>
      ) : null}
      </div>

      {hintsDismissed && !hintsExpanded ? (
        <div className="shrink-0 border-t border-zinc-200 py-3 text-center dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Don&apos;t know what to do?{" "}
            <button
              type="button"
              onClick={openAdminHints}
              className="font-medium text-cobalt-600 hover:underline dark:text-cobalt-400"
            >
              Check admin hints
            </button>
          </p>
        </div>
      ) : null}
    </AdminShell>
  );
}

function AdminUserCard({
  user,
  currentUserId,
  onUpdate,
  onPatch,
}: {
  user: AdminUser;
  currentUserId?: string;
  onUpdate: (user: AdminUser) => void;
  onPatch: (
    id: string,
    updates: { role?: AdminUser["role"]; status?: AdminUser["status"] },
  ) => Promise<AdminUser | null>;
}) {
  const isSelf = user.id === currentUserId;

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
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={user.role}
            disabled={isSelf}
            onChange={async (e) => {
              const updated = await onPatch(user.id, {
                role: e.target.value as AdminUser["role"],
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

function AdminHintsCard({
  name,
  isAdmin,
  onDismiss,
}: {
  name: string;
  isAdmin: boolean;
  onDismiss: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Welcome, {name}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Quick reference for the moderation queue. Only new locations and
            error reports need your review — routine updates confirm
            automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Dismiss admin hints"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </CardHeader>

      <CardContent className="space-y-8">
        <HintsSection title="What needs review">
          <div className="grid gap-3 sm:grid-cols-2">
            <HintTile
              badge={REPORT_KIND_LABELS.new_location}
              badgeVariant="warning"
              description="First report on a user-submitted place."
            />
            <HintTile
              badge={REPORT_KIND_LABELS.error}
              badgeVariant="warning"
              description="User reported incorrect multiplier data."
            />
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Update and confirm reports are auto-approved and won&apos;t appear
            in Reports.
          </p>
        </HintsSection>

        <HintsSection title="Report actions">
          <div className="grid gap-2 sm:grid-cols-2">
            <HintLine action="Approve" description="Stays live; leaves the queue." />
            <HintLine action="Flag" description="Marks for review; opens a flag." />
            <HintLine action="Restore" description="Clears the flag; returns to active." />
            <HintLine action="Remove" description="Hides from the public map." />
          </div>
        </HintsSection>

        <HintsSection title="Flags & places">
          <div className="grid gap-2 sm:grid-cols-2">
            <HintLine action="Resolve" description="The flagged issue is handled." />
            <HintLine action="Dismiss" description="The flag wasn't actionable." />
            <HintLine
              action="Places"
              description="Search by name, address, postal code, or UUID."
            />
            {isAdmin ? (
              <HintLine
                action="Users"
                description="Look up a UUID to change role or suspend."
              />
            ) : null}
          </div>
        </HintsSection>
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

function HintTile({
  badge,
  badgeVariant,
  description,
}: {
  badge: string;
  badgeVariant: "default" | "success" | "warning" | "danger" | "muted";
  description: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <Badge variant={badgeVariant}>{badge}</Badge>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function HintLine({
  action,
  description,
}: {
  action: string;
  description: string;
}) {
  return (
    <div className="rounded-lg px-3 py-2.5 text-sm leading-relaxed">
      <span className="font-medium text-zinc-900 dark:text-zinc-100">{action}</span>
      <span className="text-zinc-500 dark:text-zinc-400"> — {description}</span>
    </div>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-4 sm:px-6">
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="py-4">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className="mt-1 text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-zinc-500">{message}</p>;
}
