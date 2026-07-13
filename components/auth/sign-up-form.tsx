"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthDivider, AuthShell, GoogleIcon } from "@/components/auth/auth-shell";
import { EmailSentDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAuthError } from "@/lib/auth/errors";
import { getExistingAccountMessage } from "@/lib/auth/account-hints-client";
import { startEmailCooldown } from "@/lib/auth/email-cooldown";
import { createClient } from "@/lib/supabase/client";

function getRedirectPath(searchParams: URLSearchParams): string {
  const next = searchParams.get("next");
  if (next?.startsWith("/") && !next.startsWith("//")) return next;
  return "/account";
}

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  async function signUpWithGoogle() {
    setError(null);
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

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const trimmedEmail = email.trim();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: name.trim() ? { full_name: name.trim() } : undefined,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getRedirectPath(searchParams))}`,
      },
    });

    setLoading(false);

    if (signUpError) {
      const existingMessage = await getExistingAccountMessage(trimmedEmail);
      setError(existingMessage ?? formatAuthError(signUpError));
      return;
    }

    if (data.user?.identities?.length === 0) {
      const existingMessage = await getExistingAccountMessage(trimmedEmail);
      setError(
        existingMessage ??
          "An account with this email already exists. Sign in instead, or use Continue with Google.",
      );
      return;
    }

    if (data.session) {
      router.push(getRedirectPath(searchParams));
      router.refresh();
      return;
    }

    startEmailCooldown(trimmedEmail);
    setEmailDialogOpen(true);
  }

  return (
    <>
      <AuthShell
        title="Create your account"
        subtitle="Join the community map and help Cobalt cardholders find 5x merchants."
        footer={
          <>
            Already have an account?{" "}
            <Link
              href={`/login${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next")!)}` : ""}`}
              className="font-medium text-cobalt-600 hover:underline"
            >
              Sign in
            </Link>
          </>
        }
      >
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={signUpWithGoogle}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <AuthDivider />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sign-up-name">Name (optional)</Label>
            <Input
              id="sign-up-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sign-up-email">Email</Label>
            <Input
              id="sign-up-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sign-up-password">Password</Label>
            <Input
              id="sign-up-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <p className="text-xs text-zinc-500">At least 8 characters.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sign-up-confirm">Confirm password</Label>
            <Input
              id="sign-up-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
              {error.includes("already exists") && (
                <>
                  {" "}
                  <Link href="/login" className="font-medium underline">
                    Go to sign in
                  </Link>
                </>
              )}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-xs leading-relaxed text-zinc-500">
          By creating an account, you agree to contribute accurate, good-faith
          multiplier reports. If you later sign in with Google using the same
          email, Supabase will link it to this account automatically.
        </p>
      </AuthShell>

      <EmailSentDialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        email={email.trim()}
        kind="confirmation"
      />
    </>
  );
}
