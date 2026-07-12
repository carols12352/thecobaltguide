"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountDashboard } from "@/components/account/account-dashboard";
import { createClient } from "@/lib/supabase/client";
import type { MultiplierReport } from "@/types/domain";

export default function AccountPage() {
  const router = useRouter();
  const [reports, setReports] = useState<MultiplierReport[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/account");
        return;
      }

      setEmail(user.email ?? "Signed-in user");

      const res = await fetch("/api/me/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
      }

      setLoading(false);
    }

    void load();
  }, [router]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function deleteReport(id: string) {
    if (!confirm("Remove this report?")) return;
    const res = await fetch(`/api/me/reports/${id}`, { method: "DELETE" });
    if (res.ok) {
      setReports((prev) => prev.filter((report) => report.id !== id));
    }
  }

  if (loading || !email) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-zinc-500">Loading your account…</p>
      </div>
    );
  }

  return (
    <AccountDashboard
      email={email}
      reports={reports}
      onSignOut={signOut}
      onDeleteReport={deleteReport}
    />
  );
}
