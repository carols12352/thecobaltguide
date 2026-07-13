"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getCategoryLabel } from "@/config/categories";
import { formatConfidence, formatDate, formatMultiplier, formatPlaceAddress } from "@/lib/utils";
import { formatPlaceReportGroupLabel } from "@/lib/reports/place-report-groups";
import type { PlaceDetail, PlaceReportGroup } from "@/types/domain";

const PAYMENT_CONTEXTS = [
  { value: "in_store", label: "In-store" },
  { value: "online", label: "Online" },
  { value: "gas_pump", label: "Gas pump" },
  { value: "delivery", label: "Delivery" },
  { value: "other", label: "Other" },
];

export function PlaceDetails({ place }: { place: PlaceDetail }) {
  const summary = place.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{place.name}</h1>
        <p className="mt-1 text-zinc-600">{formatPlaceAddress(place)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="muted">{getCategoryLabel(place.category)}</Badge>
          {place.acceptsAmex != null && (
            <Badge variant={place.acceptsAmex ? "success" : "danger"}>
              {place.acceptsAmex ? "Accepts Amex" : "Amex not accepted"}
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Current Multiplier</h2>
        </CardHeader>
        <CardContent>
          {summary ? (
            <div className="flex items-center gap-4">
              <span className="text-4xl font-bold text-cobalt-600">
                {formatMultiplier(summary.currentMultiplier)}
              </span>
              <div>
                <Badge
                  variant={
                    summary.confidenceLevel === "high" ||
                    summary.confidenceLevel === "recently_confirmed"
                      ? "success"
                      : summary.confidenceLevel === "medium"
                        ? "warning"
                        : "muted"
                  }
                >
                  {formatConfidence(summary.confidenceLevel)}
                </Badge>
                <p className="mt-1 text-sm text-zinc-500">
                  {summary.recentReportCount} recent reports from{" "}
                  {summary.uniqueReporterCount} users · Last updated{" "}
                  {formatDate(summary.lastReportedAt)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-zinc-500">No reports yet for this location.</p>
          )}

          {summary && (
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
              {[1, 2, 3, 5].map((m) => (
                <div
                  key={m}
                  className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800"
                >
                  <div className="font-medium">{m}x</div>
                  <div className="text-zinc-500">
                    {m === 1
                      ? summary.score1x.toFixed(1)
                      : m === 2
                        ? summary.score2x.toFixed(1)
                        : m === 3
                          ? summary.score3x.toFixed(1)
                          : summary.score5x.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RecentReports placeId={place.id} />
      <ReportForm placeId={place.id} />
      <FlagForm placeId={place.id} />
    </div>
  );
}

const PAYMENT_CONTEXT_LABELS = Object.fromEntries(
  PAYMENT_CONTEXTS.map((c) => [c.value, c.label]),
) as Record<(typeof PAYMENT_CONTEXTS)[number]["value"], string>;

function RecentReports({ placeId }: { placeId: string }) {
  const [groups, setGroups] = useState<PlaceReportGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/places/${placeId}/reports`);
        if (!res.ok) return;
        const data = (await res.json()) as { groups?: PlaceReportGroup[] };
        if (!cancelled) setGroups(data.groups ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Recent Reports</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  if (groups.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Recent Reports</h2>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {groups.map((group) => (
            <li
              key={`${group.multiplier}-${group.paymentContext}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
            >
              <span>{formatPlaceReportGroupLabel(group, PAYMENT_CONTEXT_LABELS)}</span>
              <span className="text-zinc-500">
                {formatDate(group.latestTransactionDate)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ReportForm({ placeId }: { placeId: string }) {
  const [multiplier, setMultiplier] = useState("5");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [paymentContext, setPaymentContext] = useState("in_store");
  const [notes, setNotes] = useState("");
  const [reportError, setReportError] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const res = await fetch(`/api/places/${placeId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        multiplier: parseInt(multiplier, 10),
        transactionDate,
        paymentContext,
        notes: notes || undefined,
        intent: reportError ? "error" : "normal",
      }),
    });

    if (res.ok) {
      setStatus("success");
      setMessage("Report submitted! The page will refresh shortly.");
      setTimeout(() => window.location.reload(), 1500);
    } else if (res.status === 401) {
      setStatus("error");
      setMessage("Please sign in to submit a report.");
    } else if (res.status === 429) {
      const data = await res.json();
      const resetAt =
        typeof data.resetAt === "number" ? new Date(data.resetAt) : null;
      const waitLabel =
        resetAt && !Number.isNaN(resetAt.getTime())
          ? resetAt.toLocaleTimeString()
          : "a moment";
      setStatus("error");
      setMessage(
        data.error
          ? `${data.error} Try again after ${waitLabel}.`
          : `Please wait before submitting another report. Try again after ${waitLabel}.`,
      );
    } else {
      const data = await res.json();
      setStatus("error");
      setMessage(data.error ?? "Submission failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Submit Multiplier Report</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Multiplier</label>
              <Select
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
              >
                {[1, 2, 3, 5].map((m) => (
                  <option key={m} value={m}>
                    {m}x
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Transaction Date</label>
              <Input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Purchase Context</label>
            <Select
              value={paymentContext}
              onChange={(e) => setPaymentContext(e.target.value)}
            >
              {PAYMENT_CONTEXTS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid at self-checkout"
              maxLength={500}
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={reportError}
              onChange={(e) => setReportError(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300"
            />
            <span>
              Report incorrect multiplier information
              <span className="mt-0.5 block text-xs text-zinc-500">
                Sends this to moderators for review instead of a routine update.
              </span>
            </span>
          </label>

          <Button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Submitting…" : "Submit Report"}
          </Button>

          {message && (
            <p
              className={`text-sm ${status === "error" ? "text-red-600" : "text-emerald-600"}`}
            >
              {message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function FlagForm({ placeId }: { placeId: string }) {
  const [reason, setReason] = useState("wrong_address");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/places/${placeId}/flags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details: details || undefined }),
    });

    if (res.ok) {
      setMessage("Flag submitted. Thank you!");
    } else if (res.status === 401) {
      setMessage("Please sign in to flag this place.");
    } else {
      setMessage("Failed to submit flag.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Report Incorrect Information</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="duplicate">Duplicate location</option>
            <option value="wrong_address">Wrong address</option>
            <option value="permanently_closed">Permanently closed</option>
            <option value="does_not_accept_amex">Does not accept Amex</option>
            <option value="incorrect_category">Incorrect category</option>
            <option value="other">Other</option>
          </Select>
          <Input
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Additional details (optional)"
          />
          <Button type="submit" variant="outline" size="sm">
            Submit Flag
          </Button>
          {message && <p className="text-sm text-zinc-600">{message}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
