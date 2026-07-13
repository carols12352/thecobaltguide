"use client";

import { useMemo } from "react";
import { PasswordDotsInput } from "@/components/auth/password-dots-input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  analyzePasswordOverlay,
  formatPasswordOverlayHint,
  passwordInputRingClass,
} from "@/lib/auth/password-match";
import { analyzePasswordStrength } from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils";

interface PasswordSetFormProps {
  mode: "set" | "update" | "reset";
  password: string;
  confirmPassword: string;
  currentPassword?: string;
  currentPasswordVerified?: boolean;
  error: string | null;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onCurrentPasswordChange?: (value: string) => void;
  onVerifyCurrentPassword?: (e: React.FormEvent) => void;
  onResetCurrentPasswordStep?: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = analyzePasswordStrength(password);
  const isReady =
    strength.level === "good" || strength.level === "strong";

  return (
    <div className="password-strength-track" aria-hidden="true">
      <div
        className={cn(
          "password-strength-fill",
          isReady
            ? "password-strength-fill-ready"
            : "password-strength-fill-typing",
        )}
        style={{ transform: `scaleX(${strength.progress})` }}
      />
    </div>
  );
}

function NewPasswordFields({
  mode,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
}: {
  mode: "set" | "update" | "reset";
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
}) {
  const passwordLabel =
    mode === "set" ? "Set a password" : "New password";

  const overlayAnalysis = useMemo(
    () => analyzePasswordOverlay(password, confirmPassword),
    [password, confirmPassword],
  );
  const overlayActive = overlayAnalysis.segments.length > 0;
  const overlayHint = overlayActive
    ? formatPasswordOverlayHint(overlayAnalysis)
    : null;

  return (
    <div className="password-fields-stack space-y-1.5">
      <Label htmlFor="account-password">{passwordLabel}</Label>
      <PasswordDotsInput
        id="account-password"
        value={password}
        compareWith={confirmPassword}
        overlayField="password"
        onChange={onPasswordChange}
        minLength={8}
        required
        className={cn(
          "password-input-animated transition-[border-color,box-shadow] duration-200",
          passwordInputRingClass(password, confirmPassword, "password"),
        )}
      />
      <PasswordStrengthBar password={password} />
      <p className="text-xs text-zinc-500">
        Use at least 8 characters with two or more character types (uppercase,
        lowercase, numbers, symbols).
      </p>
      <Label htmlFor="account-password-confirm" className="pt-1">
        Confirm password
      </Label>
      <PasswordDotsInput
        id="account-password-confirm"
        value={confirmPassword}
        compareWith={password}
        overlayField="confirm"
        onChange={onConfirmPasswordChange}
        minLength={8}
        required
        className={cn(
          "password-input-animated transition-[border-color,box-shadow] duration-200",
          passwordInputRingClass(password, confirmPassword, "confirm"),
        )}
      />
      {overlayHint && (
        <p
          className={cn(
            "text-xs transition-colors duration-200",
            overlayAnalysis.isCompleteMatch
              ? "text-emerald-600 dark:text-emerald-400"
              : overlayAnalysis.mismatchCount > 0
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-500",
          )}
          aria-live="polite"
        >
          {overlayHint}
        </p>
      )}
    </div>
  );
}

export function PasswordSetForm({
  mode,
  password,
  confirmPassword,
  currentPassword = "",
  currentPasswordVerified = false,
  error,
  loading,
  onPasswordChange,
  onConfirmPasswordChange,
  onCurrentPasswordChange,
  onVerifyCurrentPassword,
  onResetCurrentPasswordStep,
  onSubmit,
  onCancel,
}: PasswordSetFormProps) {
  const submitLabel =
    mode === "set"
      ? "Set password"
      : mode === "reset"
        ? "Save new password"
        : "Update password";

  const showVerifyStep = mode === "update" && !currentPasswordVerified;

  return (
    <form
      onSubmit={showVerifyStep ? onVerifyCurrentPassword : onSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
    >
      {mode === "reset" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Choose a new password to finish resetting your account.
        </p>
      )}

      {mode === "update" && (
        <div className="space-y-1.5">
          <Label htmlFor="account-current-password">Current password</Label>
          <PasswordInput
            id="account-current-password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => onCurrentPasswordChange?.(event.target.value)}
            required
            disabled={currentPasswordVerified}
          />
          {currentPasswordVerified && (
            <button
              type="button"
              onClick={onResetCurrentPasswordStep}
              className="text-xs font-medium text-cobalt-600 hover:underline dark:text-cobalt-400"
            >
              Use a different current password
            </button>
          )}
        </div>
      )}

      {showVerifyStep ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Enter your current password to continue.
        </p>
      ) : (
        <NewPasswordFields
          mode={mode}
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={onPasswordChange}
          onConfirmPasswordChange={onConfirmPasswordChange}
        />
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={loading}>
          {loading
            ? showVerifyStep
              ? "Verifying…"
              : "Saving…"
            : showVerifyStep
              ? "Continue"
              : submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
