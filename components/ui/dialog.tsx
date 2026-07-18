"use client";

import { useEffect, useId, useRef } from "react";
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
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));

      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    (firstFocusable ?? panelRef.current)?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-[fade-in_160ms_ease-out] bg-zinc-950/50 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-md animate-[hero-enter_200ms_cubic-bezier(0.22,1,0.36,1)] rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl shadow-black/15 dark:border-zinc-700 dark:bg-zinc-900",
          className,
        )}
      >
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
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
