"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface AdminReport {
  id: string;
  multiplier: string;
  transaction_date: string;
  places: { name: string } | null;
}

interface AdminFlag {
  id: string;
  reason: string;
  details: string | null;
  places: { name: string } | null;
}

export default function AdminPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [flags, setFlags] = useState<AdminFlag[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [reportsRes, flagsRes] = await Promise.all([
        fetch("/api/admin/reports"),
        fetch("/api/admin/flags"),
      ]);

      if (!reportsRes.ok || !flagsRes.ok) {
        setError("Moderator access required. Sign in with a moderator account.");
        return;
      }

      const reportsData = await reportsRes.json();
      const flagsData = await flagsRes.json();
      setReports(reportsData.reports ?? []);
      setFlags(flagsData.flags ?? []);
    }
    load();
  }, []);

  async function removeReport(id: string) {
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "removed", moderationReason: "Admin removal" }),
    });
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  }

  async function resolveFlag(id: string) {
    const res = await fetch(`/api/admin/flags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    if (res.ok) {
      setFlags((prev) => prev.filter((f) => f.id !== id));
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-4 text-red-600">{error}</p>
        <Link href="/account">
          <Button variant="outline" className="mt-4">
            Go to Account
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-1 text-zinc-600">
        Review recent submissions and community flags.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold">Recent Reports</h2>
          <ul className="mt-4 space-y-2">
            {reports.map((r) => (
                <li key={r.id}>
                  <Card>
                    <CardContent className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{r.places?.name ?? "Unknown"}</p>
                        <p className="text-sm text-zinc-500">
                          {r.multiplier}x · {r.transaction_date}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeReport(r.id)}
                      >
                        Remove
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            {reports.length === 0 && (
              <p className="text-sm text-zinc-500">No recent reports.</p>
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Open Flags</h2>
          <ul className="mt-4 space-y-2">
            {flags.map((f) => (
                <li key={f.id}>
                  <Card>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{f.places?.name ?? "Unknown"}</p>
                        <Badge variant="warning">{f.reason}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {f.details ? (
                        <p className="mb-2 text-sm text-zinc-600">{f.details}</p>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveFlag(f.id)}
                      >
                        Resolve
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            {flags.length === 0 && (
              <p className="text-sm text-zinc-500">No open flags.</p>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
