"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountDashboard } from "@/components/account/account-dashboard";
import { ConfirmDialog } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import type { MultiplierReport, UserRole } from "@/types/domain";

export default function AccountPage() {
  const router = useRouter();
  const [reports, setReports] = useState<MultiplierReport[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("user");
  const [loading, setLoading] = useState(true);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role) {
        setRole(profile.role as UserRole);
      }

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

  async function confirmDeleteReport() {
    if (!deleteTargetId) return;

    setDeleting(true);
    const res = await fetch(`/api/me/reports/${deleteTargetId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setReports((prev) => prev.filter((report) => report.id !== deleteTargetId));
    }

    setDeleting(false);
    setDeleteTargetId(null);
  }

  if (loading || !email) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-zinc-500">Loading your account…</p>
      </div>
    );
  }

  return (
    <>
      <AccountDashboard
        email={email}
        role={role}
        reports={reports}
        onSignOut={signOut}
        onDeleteReport={setDeleteTargetId}
      />

      <ConfirmDialog
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteReport}
        title="Remove this report?"
        description="This report will be removed from the community summary for this merchant."
        confirmLabel="Remove report"
        loading={deleting}
      />
    </>
  );
}
