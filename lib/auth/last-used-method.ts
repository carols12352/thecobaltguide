export const LAST_USED_AUTH_METHOD_KEY = "cobalt-last-used-auth-method";

export type LastUsedAuthMethod = "google" | "password" | "magic_link";

const AUTH_METHOD_LABELS: Record<LastUsedAuthMethod, string> = {
  google: "Google",
  password: "Password",
  magic_link: "Magic link",
};

export function isLastUsedAuthMethod(
  value: string | null,
): value is LastUsedAuthMethod {
  return value === "google" || value === "password" || value === "magic_link";
}

export function getLastUsedAuthMethod(): LastUsedAuthMethod | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(LAST_USED_AUTH_METHOD_KEY);
    return isLastUsedAuthMethod(value) ? value : null;
  } catch {
    return null;
  }
}

export function setLastUsedAuthMethod(method: LastUsedAuthMethod): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LAST_USED_AUTH_METHOD_KEY, method);
  } catch {
    // Sign-in must continue when storage is unavailable or blocked.
  }
}

export function formatLastUsedAuthMethod(method: LastUsedAuthMethod): string {
  return AUTH_METHOD_LABELS[method];
}
