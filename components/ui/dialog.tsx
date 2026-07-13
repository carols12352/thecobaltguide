"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900",
          className,
        )}
      >
        <h2 id="dialog-title" className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p>{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading}>
          {loading ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

interface EmailSentDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
  kind: "magic_link" | "confirmation" | "recovery";
}

const COPY = {
  magic_link: {
    title: "Magic link sent",
    lead: "We emailed a secure sign-in link to",
  },
  confirmation: {
    title: "Confirm your email",
    lead: "We sent a confirmation link to",
  },
  recovery: {
    title: "Reset link sent",
    lead: "If an account exists, a password reset link was sent to",
  },
} as const;

export function EmailSentDialog({
  open,
  onClose,
  email,
  kind,
}: EmailSentDialogProps) {
  const copy = COPY[kind];

  return (
    <Dialog open={open} onClose={onClose} title={copy.title}>
      <p>
        {copy.lead}{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>Delivery can take a minute or two.</li>
        <li>
          If you don&apos;t see it, check your <strong>spam or promotions</strong>{" "}
          folder and mark the message as not spam.
        </li>
        <li>You can request another email after 60 seconds.</li>
      </ul>
      <Button type="button" className="mt-5 w-full" onClick={onClose}>
        Got it
      </Button>
    </Dialog>
  );
}
