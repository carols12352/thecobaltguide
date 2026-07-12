"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthDivider, AuthShell, GoogleIcon } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAuthError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

function getRedirectPath(searchParams: URLSearchParams): string {
  const next = searchParams.get("next");
  if (next?.startsWith("/") && !next.startsWith("//")) return next;
  return "/account";
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_failed"
      ? "Sign-in was cancelled or failed. Please try again."
      : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(getRedirectPath(searchParams))}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (oauthError) setError(formatAuthError(oauthError));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(formatAuthError(signInError));
      return;
    }

    router.push(getRedirectPath(searchParams));
    router.refresh();
  }

  async function handleForgotPassword() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email above, then click Forgot password.");
      return;
    }

    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      trimmed,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/account`,
      },
    );

    setLoading(false);

    if (resetError) {
      setError(formatAuthError(resetError));
      return;
    }

    setResetSent(true);
    setInfo("If an account exists for this email, a reset link is on its way.");
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to submit multiplier reports and track your contributions."
      footer={
        <>
          New here?{" "}
          <Link
            href={`/signup${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next")!)}` : ""}`}
            className="font-medium text-cobalt-600 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={signInWithGoogle}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sign-in-email">Email</Label>
          <Input
            id="sign-in-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="sign-in-password">Password</Label>
            <button
              type="button"
              className="text-xs font-medium text-cobalt-600 hover:underline"
              onClick={handleForgotPassword}
              disabled={loading || resetSent}
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="sign-in-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg bg-cobalt-50 px-3 py-2 text-sm text-cobalt-800 dark:bg-cobalt-950/40 dark:text-cobalt-200">
            {info}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-zinc-500">
        Google and email sign-in use the same email as one account when addresses
        match.
      </p>
    </AuthShell>
  );
}
