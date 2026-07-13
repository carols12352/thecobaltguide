export type PasswordStrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrengthResult {
  progress: number;
  level: PasswordStrengthLevel;
  typeCount: number;
  meetsMinimum: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
}

export function analyzePasswordStrength(password: string): PasswordStrengthResult {
  const empty: PasswordStrengthResult = {
    progress: 0,
    level: "empty",
    typeCount: 0,
    meetsMinimum: false,
    hasLower: false,
    hasUpper: false,
    hasDigit: false,
    hasSymbol: false,
  };

  if (password.length === 0) {
    return empty;
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const typeCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  let score = 0;

  if (password.length >= 8) score += 0.2;
  if (password.length >= 10) score += 0.1;
  if (password.length >= 12) score += 0.1;

  score += typeCount * 0.15;

  const progress = Math.min(score, 1);
  const meetsMinimum = password.length >= 8 && typeCount >= 2;

  let level: PasswordStrengthLevel = "weak";
  if (progress >= 0.85) level = "strong";
  else if (progress >= 0.65) level = "good";
  else if (progress >= 0.4) level = "fair";

  return {
    progress,
    level,
    typeCount,
    meetsMinimum,
    hasLower,
    hasUpper,
    hasDigit,
    hasSymbol,
  };
}

export function passwordMeetsMinimumStrength(password: string): boolean {
  return analyzePasswordStrength(password).meetsMinimum;
}
