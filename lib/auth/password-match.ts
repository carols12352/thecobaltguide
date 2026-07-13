import { passwordMeetsMinimumStrength } from "@/lib/auth/password-strength";

export type PasswordCharStatus = "empty" | "match" | "mismatch" | "extra";
export type PasswordOverlayStatus = "match" | "mismatch" | "pending" | "extra";

export interface PasswordMatchAnalysis {
  segments: PasswordCharStatus[];
  matchedCount: number;
  mismatchCount: number;
  isCompleteMatch: boolean;
}

export interface PasswordOverlayAnalysis {
  segments: PasswordOverlayStatus[];
  matchedCount: number;
  mismatchCount: number;
  pendingCount: number;
  extraCount: number;
  isCompleteMatch: boolean;
}

export function analyzePasswordOverlay(
  password: string,
  confirm: string,
): PasswordOverlayAnalysis {
  if (confirm.length === 0 || password.length === 0) {
    return {
      segments: [],
      matchedCount: 0,
      mismatchCount: 0,
      pendingCount: 0,
      extraCount: 0,
      isCompleteMatch: false,
    };
  }

  const segments: PasswordOverlayStatus[] = [];
  let matchedCount = 0;
  let mismatchCount = 0;
  let pendingCount = 0;

  for (let index = 0; index < password.length; index += 1) {
    if (index >= confirm.length) {
      segments.push("pending");
      pendingCount += 1;
      continue;
    }

    if (password[index] === confirm[index]) {
      segments.push("match");
      matchedCount += 1;
    } else {
      segments.push("mismatch");
      mismatchCount += 1;
    }
  }

  return {
    segments,
    matchedCount,
    mismatchCount,
    pendingCount,
    extraCount: 0,
    isCompleteMatch:
      password.length >= 8 &&
      confirm.length >= 8 &&
      password === confirm,
  };
}

export function analyzeConfirmOverlay(
  password: string,
  confirm: string,
): PasswordOverlayAnalysis {
  if (confirm.length === 0 || password.length === 0) {
    return {
      segments: [],
      matchedCount: 0,
      mismatchCount: 0,
      pendingCount: 0,
      extraCount: 0,
      isCompleteMatch: false,
    };
  }

  const segments: PasswordOverlayStatus[] = [];
  let matchedCount = 0;
  let mismatchCount = 0;
  let extraCount = 0;

  for (let index = 0; index < confirm.length; index += 1) {
    if (index >= password.length) {
      segments.push("extra");
      extraCount += 1;
      continue;
    }

    if (password[index] === confirm[index]) {
      segments.push("match");
      matchedCount += 1;
    } else {
      segments.push("mismatch");
      mismatchCount += 1;
    }
  }

  return {
    segments,
    matchedCount,
    mismatchCount,
    pendingCount: 0,
    extraCount,
    isCompleteMatch:
      password.length >= 8 &&
      confirm.length >= 8 &&
      password === confirm,
  };
}

export function analyzePasswordMatch(
  password: string,
  confirm: string,
): PasswordMatchAnalysis {
  if (confirm.length === 0) {
    return {
      segments: [],
      matchedCount: 0,
      mismatchCount: 0,
      isCompleteMatch: false,
    };
  }

  const segments: PasswordCharStatus[] = [];
  let matchedCount = 0;
  let mismatchCount = 0;

  for (let index = 0; index < confirm.length; index += 1) {
    if (index >= password.length) {
      segments.push("extra");
      mismatchCount += 1;
      continue;
    }

    if (password[index] === confirm[index]) {
      segments.push("match");
      matchedCount += 1;
    } else {
      segments.push("mismatch");
      mismatchCount += 1;
    }
  }

  return {
    segments,
    matchedCount,
    mismatchCount,
    isCompleteMatch:
      password.length >= 8 &&
      confirm.length >= 8 &&
      password === confirm,
  };
}

export function formatPasswordMatchHint(
  analysis: PasswordMatchAnalysis | PasswordOverlayAnalysis,
): string | null {
  if (analysis.segments.length === 0) return null;

  if (analysis.isCompleteMatch) {
    return "Passwords match.";
  }

  if (analysis.mismatchCount === 0) {
    return "Keep typing to match your password.";
  }

  const firstMismatch = analysis.segments.findIndex(
    (status) => status === "mismatch" || status === "extra",
  );

  if (firstMismatch === -1) {
    return `${analysis.mismatchCount} character${analysis.mismatchCount === 1 ? "" : "s"} do not match.`;
  }

  return `Character ${firstMismatch + 1} does not match (${analysis.mismatchCount} mismatch${analysis.mismatchCount === 1 ? "" : "es"} so far).`;
}

export function formatPasswordOverlayHint(
  analysis: PasswordOverlayAnalysis,
): string | null {
  if (analysis.segments.length === 0) return null;

  if (analysis.isCompleteMatch) {
    return "Passwords match.";
  }

  if (analysis.mismatchCount === 0) {
    return "Keep typing to match your password.";
  }

  const firstMismatch = analysis.segments.findIndex(
    (status) => status === "mismatch",
  );

  if (firstMismatch === -1) {
    return `${analysis.mismatchCount} character${analysis.mismatchCount === 1 ? "" : "s"} do not match.`;
  }

  return `Character ${firstMismatch + 1} does not match (${analysis.mismatchCount} mismatch${analysis.mismatchCount === 1 ? "" : "es"} so far).`;
}

export function passwordInputRingClass(
  password: string,
  confirm: string,
  field: "password" | "confirm",
): string {
  if (field === "password") {
    if (password.length === 0) return "";

    if (confirm.length > 0) {
      const overlay = analyzePasswordOverlay(password, confirm);
      if (overlay.isCompleteMatch) {
        return "border-emerald-400 focus-visible:ring-emerald-500/40";
      }
      if (overlay.mismatchCount > 0) {
        return "border-red-400 focus-visible:ring-red-500/40";
      }
      if (overlay.extraCount > 0) {
        return "border-amber-400 focus-visible:ring-amber-500/40";
      }
      return "border-amber-400 focus-visible:ring-amber-500/40";
    }

    if (passwordMeetsMinimumStrength(password)) {
      return "border-emerald-400 focus-visible:ring-emerald-500/40";
    }
    return "border-amber-400 focus-visible:ring-amber-500/40";
  }

  if (confirm.length === 0) return "";

  const confirmOverlay = analyzeConfirmOverlay(password, confirm);
  if (confirmOverlay.isCompleteMatch) {
    return "border-emerald-400 focus-visible:ring-emerald-500/40";
  }
  if (confirmOverlay.mismatchCount > 0) {
    return "border-red-400 focus-visible:ring-red-500/40";
  }
  if (confirmOverlay.extraCount > 0) {
    return "border-amber-400 focus-visible:ring-amber-500/40";
  }
  return "border-amber-400 focus-visible:ring-amber-500/40";
}
