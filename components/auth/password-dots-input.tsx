"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { PasswordVisibilityIcon } from "@/components/auth/password-input";
import {
  analyzeConfirmOverlay,
  analyzePasswordOverlay,
  type PasswordOverlayStatus,
} from "@/lib/auth/password-match";
import { cn } from "@/lib/utils";

/** Shared monospace sizing so overlay columns line up with native password bullets. */
export const PASSWORD_INPUT_CLASS =
  "password-char-input h-8 py-1 pr-10 font-mono tracking-normal";

interface PasswordDotsInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  minLength?: number;
  required?: boolean;
  /** Compare against the other field and show per-character overlay bars. */
  compareWith?: string;
  overlayField?: "password" | "confirm";
}

interface BulletMetrics {
  charWidth: number;
  dotWidth: number;
  firstDotWidth: number;
  paddingLeft: number;
}

function measureBulletMetrics(input: HTMLInputElement): BulletMetrics {
  const style = window.getComputedStyle(input);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  let charWidth = 8;
  let dotWidth = 4;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context) {
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const characterMetrics = context.measureText("0");
    const bulletMetrics = context.measureText("•");
    charWidth = characterMetrics.width || bulletMetrics.width || charWidth;
    const glyphWidth =
      (bulletMetrics.actualBoundingBoxLeft ?? 0) +
      (bulletMetrics.actualBoundingBoxRight ?? 0);
    if (glyphWidth > 0) {
      dotWidth = Math.min(glyphWidth, charWidth * 0.6);
    }
  }

  return {
    charWidth,
    dotWidth,
    // Native password masking gives the first glyph a little more visual
    // breathing room than the repeated glyphs that follow it. Scale the
    // compensation with the measured character cell so it stays aligned
    // across fonts, zoom levels, and responsive input sizes.
    firstDotWidth: Math.min(
      charWidth,
      dotWidth + Math.max(1, (charWidth - dotWidth) * 0.25),
    ),
    paddingLeft,
  };
}

function usePasswordBulletMetrics(
  inputRef: React.RefObject<HTMLInputElement | null>,
  value: string,
) {
  const [metrics, setMetrics] = useState<BulletMetrics>({
    charWidth: 0,
    dotWidth: 0,
    firstDotWidth: 0,
    paddingLeft: 0,
  });

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const update = () => setMetrics(measureBulletMetrics(input));
    update();

    const observer = new ResizeObserver(update);
    observer.observe(input);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [inputRef, value]);

  return metrics;
}

function dotHighlightClass(status: PasswordOverlayStatus): string {
  switch (status) {
    case "match":
      return "password-dot-bar-match";
    case "mismatch":
      return "password-dot-bar-mismatch";
    case "extra":
      return "password-dot-bar-extra";
    default:
      return "";
  }
}

interface PasswordOverlayRun {
  start: number;
  length: number;
  status: Exclude<PasswordOverlayStatus, "pending">;
}

function buildOverlayRuns(
  segments: PasswordOverlayStatus[],
  valueLength: number,
): PasswordOverlayRun[] {
  const runs: PasswordOverlayRun[] = [];

  segments.slice(0, valueLength).forEach((status, index) => {
    if (status === "pending") return;

    const previous = runs.at(-1);
    if (
      previous &&
      previous.status === status &&
      previous.start + previous.length === index
    ) {
      previous.length += 1;
      return;
    }

    runs.push({ start: index, length: 1, status });
  });

  return runs;
}

function PasswordMatchOverlay({
  inputRef,
  value,
  segments,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  segments: PasswordOverlayStatus[];
}) {
  const metrics = usePasswordBulletMetrics(inputRef, value);
  const runs = useMemo(
    () => buildOverlayRuns(segments, value.length),
    [segments, value.length],
  );

  if (runs.length === 0 || value.length === 0 || metrics.charWidth <= 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-10"
      style={{
        left: metrics.paddingLeft,
        width: value.length * metrics.charWidth,
      }}
      aria-hidden="true"
    >
      {runs.map((run, runIndex) => {
        const startWidth =
          run.start === 0 ? metrics.firstDotWidth : metrics.dotWidth;
        const previousRun = runs[runIndex - 1];
        const nextRun = runs[runIndex + 1];
        const joinsPrevious =
          previousRun !== undefined &&
          previousRun.start + previousRun.length === run.start;
        const joinsNext =
          nextRun !== undefined &&
          run.start + run.length === nextRun.start;
        const edgeExtension = Math.max(
          1,
          (metrics.charWidth - metrics.dotWidth) * 0.2,
        );
        const baseLeft = joinsPrevious
          ? run.start * metrics.charWidth
          : run.start * metrics.charWidth +
            (metrics.charWidth - startWidth) / 2;
        const left = runIndex === 0 ? baseLeft - edgeExtension : baseLeft;
        const end = run.start + run.length;
        const endWidth =
          end === value.length ? metrics.firstDotWidth : metrics.dotWidth;
        const baseRight = joinsNext
          ? end * metrics.charWidth
          : (end - 1) * metrics.charWidth +
            (metrics.charWidth + endWidth) / 2;
        const right =
          runIndex === runs.length - 1
            ? baseRight + edgeExtension
            : baseRight;
        return (
          <span
            key={`${run.start}-${run.status}`}
            className={cn(
              "password-dot-bar absolute",
              dotHighlightClass(run.status),
            )}
            style={{
              left,
              width: right - left,
              borderTopLeftRadius: joinsPrevious ? 0 : undefined,
              borderBottomLeftRadius: joinsPrevious ? 0 : undefined,
              borderTopRightRadius: joinsNext ? 0 : undefined,
              borderBottomRightRadius: joinsNext ? 0 : undefined,
            }}
            title={
              run.status === "match"
                ? `${run.length} matching position${run.length === 1 ? "" : "s"}`
                : run.status === "extra"
                  ? `${run.length} position${run.length === 1 ? "" : "s"} exceed the password length`
                  : `${run.length} position${run.length === 1 ? "" : "s"} do not match`
            }
          />
        );
      })}
    </div>
  );
}

export function PasswordDotsInput({
  id,
  value,
  onChange,
  className,
  minLength,
  required,
  compareWith,
  overlayField,
}: PasswordDotsInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const segments = useMemo(() => {
    if (compareWith === undefined || overlayField === undefined) {
      return [];
    }

    if (overlayField === "password") {
      return analyzePasswordOverlay(value, compareWith).segments;
    }

    return analyzeConfirmOverlay(compareWith, value).segments;
  }, [compareWith, overlayField, value]);

  const showOverlay = segments.length > 0;

  return (
    <div className="relative w-full">
      {showOverlay && (
        <PasswordMatchOverlay
          inputRef={inputRef}
          value={value}
          segments={segments}
        />
      )}
      <Input
        ref={inputRef}
        id={id}
        type={passwordVisible ? "text" : "password"}
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={minLength}
        required={required}
        className={cn(PASSWORD_INPUT_CLASS, className)}
      />
      <button
        type="button"
        onClick={() => setPasswordVisible((visible) => !visible)}
        aria-label={passwordVisible ? "Hide password" : "Show password"}
        aria-pressed={passwordVisible}
        title={passwordVisible ? "Hide password" : "Show password"}
        className="absolute right-1 top-1/2 z-20 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <PasswordVisibilityIcon visible={passwordVisible} />
      </button>
    </div>
  );
}
