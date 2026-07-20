"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthDivider, AuthShell, GoogleIcon } from "@/components/auth/auth-shell";
import { EmailSentDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Label } from "@/components/ui/label";
import { AUTH_EMAIL_COOLDOWN_SECONDS } from "@/config/constants";
import { formatAuthError } from "@/lib/auth/errors";
import {
  formatLastUsedAuthMethod,
  getLastUsedAuthMethod,
  setLastUsedAuthMethod,
  type LastUsedAuthMethod,
} from "@/lib/auth/last-used-method";
import {
  isEmailCooldownActive,
  startEmailCooldown,
} from "@/lib/auth/email-cooldown";
import {
  formatCooldownSeconds,
  useEmailCooldown,
} from "@/lib/auth/use-email-cooldown";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SignInMode = "password" | "magic_link";
type EmailDialogKind = "magic_link" | "recovery";

function getRedirectPath(searchParams: URLSearchParams): string {
  const next = searchParams.get("next");
  if (next?.startsWith("/") && !next.startsWith("//")) return next;
  return "/account";
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<SignInMode>(() => {
    const method = getLastUsedAuthMethod();
    return method === "magic_link" ? "magic_link" : "password";
  });
  const [lastUsedMethod, setLastUsedMethodState] =
    useState<LastUsedAuthMethod | null>(() => getLastUsedAuthMethod());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_failed"
      ? "Sign-in was cancelled or failed. Please try again."
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDialogKind, setEmailDialogKind] =
    useState<EmailDialogKind>("magic_link");
  const cooldownRemainingMs = useEmailCooldown(email);
  const cooldownSeconds = formatCooldownSeconds(cooldownRemainingMs);
  const cooldownActive = cooldownRemainingMs > 0;

  function rememberMethod(method: LastUsedAuthMethod) {
    setLastUsedAuthMethod(method);
    setLastUsedMethodState(method);
  }

  async function signInWithGoogle() {
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(getRedirectPath(searchParams))}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (oauthError) {
      setError(formatAuthError(oauthError));
      return;
    }

    rememberMethod("google");
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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

    rememberMethod("password");
    router.push(getRedirectPath(searchParams));
    router.refresh();
  }

  async function sendMagicLink() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address first.");
      return;
    }

    if (isEmailCooldownActive(trimmed)) {
      setError(
        `Please wait ${cooldownSeconds}s before requesting another email.`,
      );
      return;
    }

    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getRedirectPath(searchParams))}`,
      },
    });

    setLoading(false);

    if (otpError) {
      setError(formatAuthError(otpError));
      return;
    }

    startEmailCooldown(trimmed);
    rememberMethod("magic_link");
    setEmailDialogKind("magic_link");
    setEmailDialogOpen(true);
  }

  async function handleForgotPassword() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email above, then click Forgot password.");
      return;
    }

    if (isEmailCooldownActive(trimmed)) {
      setError(
        `Please wait ${cooldownSeconds}s before requesting another email.`,
      );
      return;
    }

    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      trimmed,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account?password=reset")}`,
      },
    );

    setLoading(false);

    if (resetError) {
      setError(formatAuthError(resetError));
      return;
    }

    startEmailCooldown(trimmed);
    setEmailDialogKind("recovery");
    setEmailDialogOpen(true);
  }

  return (
    <>
      <AuthShell
        title="Welcome back"
        subtitle="Sign in to contribute."
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
          {lastUsedMethod === "google" ? <LastUsedLabel /> : null}
        </Button>

        <AuthDivider />

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          {(["password", "magic_link"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                mode === option
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
              onClick={() => {
                setMode(option);
                setError(null);
              }}
            >
              <span>{option === "password" ? "Password" : "Magic link"}</span>
              {lastUsedMethod === option ? <LastUsedDot /> : null}
            </button>
          ))}
        </div>

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

        {mode === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sign-in-password">Password</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-cobalt-600 hover:underline disabled:opacity-50"
                  onClick={handleForgotPassword}
                  disabled={loading || cooldownActive}
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                id="sign-in-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <AuthError message={error} />}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              We&apos;ll email a one-time sign-in link. Resend after {AUTH_EMAIL_COOLDOWN_SECONDS} seconds.
            </p>

            {error && <AuthError message={error} />}

            <Button
              type="button"
              className="w-full"
              disabled={loading || cooldownActive}
              onClick={sendMagicLink}
            >
              {loading
                ? "Sending…"
                : cooldownActive
                  ? `Resend in ${cooldownSeconds}s`
                  : "Send magic link"}
            </Button>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-zinc-500">
          {lastUsedMethod
            ? `${formatLastUsedAuthMethod(lastUsedMethod)} was last used on this device.`
            : "Your last sign-in method will be remembered only on this device."}
        </p>
      </AuthShell>

      <EmailSentDialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        email={email.trim()}
        kind={emailDialogKind}
      />
    </>
  );
}

function LastUsedLabel() {
  return (
    <span className="ml-auto text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
      Last used
    </span>
  );
}

function LastUsedDot() {
  return (
    <span
      className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-cobalt-500"
      aria-label="Last used on this device"
    />
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
      {message}
    </p>
  );
}
