"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CONFIDENCE_LEVELS, MULTIPLIER_OPTIONS } from "@/config/constants";
import { getCategoryLabel } from "@/config/categories";
import {
  formatConfidence,
  formatDate,
  formatMultiplier,
  formatPlaceAddress,
} from "@/lib/utils";
import type { AdminPlaceDetail, ConfidenceLevel, MultiplierValue } from "@/types/domain";

const LocationPicker = dynamic(
  () =>
    import("@/components/map/location-picker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => <p className="text-sm text-zinc-500">Loading map…</p>,
  },
);

function noop() {}

export function AdminPlaceDetailView({ placeId }: { placeId: string }) {
  const [place, setPlace] = useState<AdminPlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confidenceLevel, setConfidenceLevel] =
    useState<ConfidenceLevel>("insufficient");
  const [confidenceScore, setConfidenceScore] = useState("0");
  const [currentMultiplier, setCurrentMultiplier] = useState<string>("");

  const loadPlace = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/places/${placeId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to load place.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    const loaded = data.place as AdminPlaceDetail;
    setPlace(loaded);
    setConfidenceLevel(loaded.summary?.confidenceLevel ?? "insufficient");
    setConfidenceScore(String(loaded.summary?.confidenceScore ?? 0));
    setCurrentMultiplier(
      loaded.summary?.currentMultiplier
        ? String(loaded.summary.currentMultiplier)
        : "",
    );
    setLoading(false);
  }, [placeId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPlace(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadPlace]);

  async function saveSummary(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);

    const res = await fetch(`/api/admin/places/${placeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: {
          confidenceLevel,
          confidenceScore: Number(confidenceScore),
          ...(currentMultiplier
            ? { currentMultiplier: Number(currentMultiplier) }
            : {}),
        },
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSaveError(data?.error ?? "Could not save summary.");
      return;
    }

    const data = await res.json();
    setPlace(data.place as AdminPlaceDetail);
  }

  async function updateStatus(
    status: AdminPlaceDetail["status"],
  ) {
    setSaveError(null);
    const res = await fetch(`/api/admin/places/${placeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSaveError(data?.error ?? "Could not update place status.");
      return;
    }

    const data = await res.json();
    setPlace(data.place as AdminPlaceDetail);
  }

  if (loading) {
    return (
      <AdminPlaceShell>
        <p className="text-sm text-zinc-500">Loading place…</p>
      </AdminPlaceShell>
    );
  }

  if (error || !place) {
    return (
      <AdminPlaceShell>
        <p className="text-red-600">{error ?? "Place not found."}</p>
        <Link href="/admin">
          <Button variant="outline" className="mt-4">
            Back to dashboard
          </Button>
        </Link>
      </AdminPlaceShell>
    );
  }

  const mapsUrl = `https://www.google.com/maps?q=${place.latitude},${place.longitude}`;

  return (
    <AdminPlaceShell>
      <div className="shrink-0 space-y-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/admin"
              className="text-sm font-medium text-cobalt-600 hover:underline"
            >
              ← Admin dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold">{place.name}</h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {formatPlaceAddress(place)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="muted">{getCategoryLabel(place.category)}</Badge>
              <Badge
                variant={place.status === "active" ? "success" : "warning"}
              >
                {place.status.replaceAll("_", " ")}
              </Badge>
              {place.openFlagCount > 0 ? (
                <Badge variant="warning">
                  {place.openFlagCount} open flag
                  {place.openFlagCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/place/${place.id}`} target="_blank">
              <Button variant="outline" size="sm">
                Public page
              </Button>
            </Link>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                Open in Maps
              </Button>
            </a>
          </div>
        </div>
        {saveError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Exact location</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Full coordinates and map pin — not shown on the public page.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <MetadataItem label="Latitude" value={place.latitude.toFixed(6)} />
                <MetadataItem label="Longitude" value={place.longitude.toFixed(6)} />
                <MetadataItem label="Postal code" value={place.postalCode} />
                <MetadataItem label="Country" value={place.countryCode} />
              </dl>
              <LocationPicker
                latitude={place.latitude}
                longitude={place.longitude}
                onChange={noop}
                readOnly
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Internal metadata</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Moderator-only identifiers and audit fields.
              </p>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <MetadataItem label="Place ID" value={place.id} mono />
                <MetadataItem
                  label="Normalized name"
                  value={place.normalizedName}
                  mono
                />
                <MetadataItem
                  label="External place ID"
                  value={place.externalPlaceId ?? "—"}
                  mono
                />
                <MetadataItem
                  label="Created by"
                  value={
                    place.createdByUsername
                      ? `${place.createdByUsername} (${place.createdBy})`
                      : (place.createdBy ?? "—")
                  }
                  mono={Boolean(place.createdBy)}
                />
                <MetadataItem label="Created" value={formatDate(place.createdAt)} />
                <MetadataItem label="Updated" value={formatDate(place.updatedAt)} />
                <MetadataItem label="Brand" value={place.brandName ?? "—"} />
                <MetadataItem
                  label="Accepts Amex"
                  value={
                    place.acceptsAmex == null
                      ? "Unknown"
                      : place.acceptsAmex
                        ? "Yes"
                        : "No"
                  }
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-semibold">Multiplier summary</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Manually override confidence and displayed multiplier. New community
              reports may recalculate scores unless you adjust again.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {place.summary ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <MetadataItem
                  label="Recent reports"
                  value={String(place.summary.recentReportCount)}
                />
                <MetadataItem
                  label="Unique reporters"
                  value={String(place.summary.uniqueReporterCount)}
                />
                <MetadataItem
                  label="Last reported"
                  value={formatDate(place.summary.lastReportedAt)}
                />
                <MetadataItem
                  label="Score totals"
                  value={`1x ${place.summary.score1x.toFixed(1)} · 2x ${place.summary.score2x.toFixed(1)} · 3x ${place.summary.score3x.toFixed(1)} · 5x ${place.summary.score5x.toFixed(1)}`}
                />
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">No summary row yet — save to create one.</p>
            )}

            <form onSubmit={(e) => void saveSummary(e)} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="confidence-level">Confidence level</Label>
                <Select
                  id="confidence-level"
                  value={confidenceLevel}
                  onChange={(e) =>
                    setConfidenceLevel(e.target.value as ConfidenceLevel)
                  }
                >
                  {CONFIDENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {formatConfidence(level)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="confidence-score">Confidence score (0–1)</Label>
                <Input
                  id="confidence-score"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={confidenceScore}
                  onChange={(e) => setConfidenceScore(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="current-multiplier">Current multiplier</Label>
                <Select
                  id="current-multiplier"
                  value={currentMultiplier}
                  onChange={(e) => setCurrentMultiplier(e.target.value)}
                >
                  <option value="">None</option>
                  {MULTIPLIER_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {formatMultiplier(value as MultiplierValue)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save summary overrides"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-semibold">Place status</h2>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {place.status !== "active" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void updateStatus("active")}
              >
                Mark active
              </Button>
            ) : null}
            {place.status !== "permanently_closed" ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void updateStatus("permanently_closed")}
              >
                Mark permanently closed
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AdminPlaceShell>
  );
}

function AdminPlaceShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-4 sm:px-6">
      {children}
    </div>
  );
}

function MetadataItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className={mono ? "font-mono text-xs break-all" : "font-medium"}>
        {value}
      </dd>
    </div>
  );
}
