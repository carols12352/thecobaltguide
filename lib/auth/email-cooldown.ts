import { AUTH_EMAIL_COOLDOWN_SECONDS } from "@/config/constants";

export { AUTH_EMAIL_COOLDOWN_SECONDS };

const STORAGE_PREFIX = "cobalt:auth-email-cooldown:";

function storageKey(email: string): string {
  return STORAGE_PREFIX + email.trim().toLowerCase();
}

export function getEmailCooldownRemainingMs(email: string): number {
  if (typeof localStorage === "undefined" || !email.trim()) return 0;

  const until = Number(localStorage.getItem(storageKey(email)));
  if (!until || Number.isNaN(until)) return 0;

  return Math.max(0, until - Date.now());
}

export function startEmailCooldown(email: string): void {
  if (typeof localStorage === "undefined" || !email.trim()) return;

  localStorage.setItem(
    storageKey(email),
    String(Date.now() + AUTH_EMAIL_COOLDOWN_SECONDS * 1000),
  );
}

export function isEmailCooldownActive(email: string): boolean {
  return getEmailCooldownRemainingMs(email) > 0;
}
