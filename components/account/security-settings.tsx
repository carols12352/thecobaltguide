"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthMethodList } from "@/components/auth/auth-method-list";
import { PasswordSetForm } from "@/components/auth/password-set-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { formatAuthError } from "@/lib/auth/errors";
import { getSecurityStateFromUser } from "@/lib/auth/providers";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type PasswordFormMode = "set" | "update" | "reset";

export function SecuritySettings() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [hasPasswordLogin, setHasPasswordLogin] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [passwordFormMode, setPasswordFormMode] = useState<PasswordFormMode>("set");
  const [currentPasswordVerified, setCurrentPasswordVerified] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const applyUserSecurityState = useCallback((currentUser: User | null) => {
    const state = getSecurityStateFromUser(currentUser);
    setUser(currentUser);
    setProviders(state.providers);
    setHasPasswordLogin(state.hasPasswordLogin);
  }, []);

  const openPasswordForm = useCallback((mode: PasswordFormMode) => {
    setPasswordFormMode(mode);
    setPasswordFormOpen(true);
    setCurrentPasswordVerified(false);
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }, []);

  function closePasswordForm() {
    setPasswordFormOpen(false);
    setCurrentPasswordVerified(false);
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      applyUserSecurityState(currentUser ?? null);
      setInitialLoading(false);
    }

    void load();
  }, [applyUserSecurityState]);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        openPasswordForm("reset");
        return;
      }

      if (event === "USER_UPDATED" || event === "SIGNED_IN") {
        applyUserSecurityState(session?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, [applyUserSecurityState, openPasswordForm]);

  useEffect(() => {
    if (searchParams.get("password") === "reset") {
      openPasswordForm("reset");
    }
  }, [searchParams, openPasswordForm]);

  function handleCurrentPasswordChange(value: string) {
    setCurrentPassword(value);
    if (currentPasswordVerified) {
      setCurrentPasswordVerified(false);
      setPassword("");
      setConfirmPassword("");
    }
  }

  function resetCurrentPasswordStep() {
    setCurrentPasswordVerified(false);
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  async function handleVerifyCurrentPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }

    if (!user?.email) {
      setError("Account email is missing.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    setLoading(false);

    if (verifyError) {
      setError("Current password is incorrect.");
      return;
    }

    setCurrentPasswordVerified(true);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (passwordFormMode === "update" && !currentPasswordVerified) {
      setError("Verify your current password first.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (passwordFormMode === "update") {
      if (currentPassword === password) {
        setError("New password must be different from your current password.");
        return;
      }
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
      data: { has_password: true },
    });

    setLoading(false);

    if (updateError) {
      setError(formatAuthError(updateError));
      return;
    }

    applyUserSecurityState(data.user ?? user);
    closePasswordForm();
    setSuccessOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Sign-in methods</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Manage linked providers and your email sign-in password.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {initialLoading ? (
            <p className="text-sm text-zinc-500">Loading security settings…</p>
          ) : (
            <>
              <AuthMethodList linkedProviders={providers} />

              <div className="border-t border-zinc-200 pt-5 dark:border-zinc-700">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Email and password</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {hasPasswordLogin
                        ? "You can sign in with your email and password on the login page."
                        : "Set a password to also sign in with email on the login page."}
                    </p>
                  </div>
                  {!passwordFormOpen && (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() =>
                        openPasswordForm(hasPasswordLogin ? "update" : "set")
                      }
                    >
                      {hasPasswordLogin ? "Change password" : "Set password"}
                    </Button>
                  )}
                </div>

                {passwordFormOpen && (
                  <div className="mt-4">
                    <PasswordSetForm
                      mode={passwordFormMode}
                      currentPassword={currentPassword}
                      currentPasswordVerified={currentPasswordVerified}
                      password={password}
                      confirmPassword={confirmPassword}
                      error={error}
                      loading={loading}
                      onCurrentPasswordChange={handleCurrentPasswordChange}
                      onVerifyCurrentPassword={handleVerifyCurrentPassword}
                      onResetCurrentPasswordStep={resetCurrentPasswordStep}
                      onPasswordChange={setPassword}
                      onConfirmPasswordChange={setConfirmPassword}
                      onSubmit={handleSetPassword}
                      onCancel={closePasswordForm}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Password saved"
      >
        <p>
          You can now sign in with your email and password on the login page, in
          addition to any linked providers.
        </p>
        <Button
          type="button"
          className="mt-5 w-full"
          onClick={() => setSuccessOpen(false)}
        >
          Done
        </Button>
      </Dialog>
    </>
  );
}
