"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function PrivacySettings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/me/data");
      if (!response.ok) throw new Error("Could not export your data.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cobalt-account-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Could not export your data.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Your data</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Download a copy of the data associated with your account.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Your export includes your account profile, reports, flags, and
            locations you created.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={exportData}
          >
            {loading ? "Preparing…" : "Export data"}
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DangerZone() {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (confirmation !== "DELETE") return;
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/me/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      if (!response.ok) throw new Error("Could not delete your account.");

      await createClient().auth.signOut({ scope: "local" });
      router.replace("/");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete your account.",
      );
      setLoading(false);
    }
  }

  return (
    <section className="mt-12 border-t border-red-200 pt-8 dark:border-red-950/70">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-red-700 uppercase dark:text-red-300">
            Danger zone
          </p>
          <h2 className="mt-2 text-lg font-semibold">Delete account</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            This permanently removes your profile, authentication data, report
            notes, and flag details. Anonymous contribution values and audit
            records remain so community results stay accurate.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          disabled={loading}
          onClick={() => {
            setConfirmation("");
            setError(null);
            setDeleteOpen(true);
          }}
        >
          Delete account
        </Button>
      </div>
      {error && !deleteOpen ? (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}

      <Dialog
        open={deleteOpen}
        onClose={() => !loading && setDeleteOpen(false)}
        title="Permanently delete account?"
      >
        <p>
          This cannot be undone. Export your data first if you want to keep a
          copy, then type <strong>DELETE</strong> to continue.
        </p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="delete-account-confirmation">Confirmation</Label>
          <Input
            id="delete-account-confirmation"
            value={confirmation}
            autoComplete="off"
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => setDeleteOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={confirmation !== "DELETE" || loading}
            onClick={deleteAccount}
          >
            {loading ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
