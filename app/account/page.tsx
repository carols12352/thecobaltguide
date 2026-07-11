"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatMultiplier } from "@/lib/utils";
import type { MultiplierReport } from "@/types/domain";

export default function AccountPage() {
  const [reports, setReports] = useState<MultiplierReport[]>([]);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        const res = await fetch("/api/me/reports");
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports ?? []);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function signInWithEmail() {
    const email = prompt("Enter your email for a magic link:");
    if (!email) return;
    const supabase = createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    alert("Check your email for the sign-in link.");
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function deleteReport(id: string) {
    if (!confirm("Remove this report?")) return;
    const res = await fetch(`/api/me/reports/${id}`, { method: "DELETE" });
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  }

  if (loading) {
    return <p className="p-8 text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Account</h1>

      {!user ? (
        <Card className="mt-6">
          <CardContent className="space-y-3 py-6">
            <p className="text-zinc-600">
              Sign in to submit multiplier reports and track your contributions.
            </p>
            <div className="flex gap-2">
              <Button onClick={signInWithGoogle}>Sign in with Google</Button>
              <Button variant="outline" onClick={signInWithEmail}>
                Email magic link
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mt-2 text-zinc-600">
            Signed in as {user.email}
            <Button variant="ghost" size="sm" onClick={signOut} className="ml-2">
              Sign out
            </Button>
          </p>

          <h2 className="mt-8 text-lg font-semibold">My Reports</h2>
          {reports.length === 0 ? (
            <p className="mt-2 text-zinc-500">
              No reports yet.{" "}
              <Link href="/submit" className="text-cobalt-600 underline">
                Submit one
              </Link>
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {reports.map((r) => (
                <li key={r.id}>
                  <Card>
                    <CardContent className="flex items-center justify-between py-3">
                      <div>
                        <Link
                          href={`/place/${r.placeId}`}
                          className="font-medium hover:underline"
                        >
                          View place
                        </Link>
                        <p className="text-sm text-zinc-500">
                          {formatMultiplier(r.multiplier)} ·{" "}
                          {formatDate(r.transactionDate)} · {r.paymentContext}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={r.status === "active" ? "success" : "muted"}
                        >
                          {r.status}
                        </Badge>
                        {r.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteReport(r.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
