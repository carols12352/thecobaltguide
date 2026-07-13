import {
  formatAccountExistsMessage,
  formatProviderLabel,
  userHasEmailPassword,
} from "@/lib/auth/providers";

export interface AccountHintsResponse {
  exists: boolean;
  providers: string[];
  lastProvider: string | null;
}

export async function fetchAccountHints(
  email: string,
): Promise<AccountHintsResponse | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(
      `/api/auth/account-hints?email=${encodeURIComponent(trimmed)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as AccountHintsResponse;
  } catch {
    return null;
  }
}

export async function getExistingAccountMessage(
  email: string,
): Promise<string | null> {
  const hints = await fetchAccountHints(email);
  if (!hints?.exists) return null;

  return formatAccountExistsMessage(hints.providers, hints.lastProvider);
}

export async function getSignInErrorMessage(
  email: string,
  fallbackMessage: string,
): Promise<string> {
  const hints = await fetchAccountHints(email);
  if (!hints?.exists) return fallbackMessage;

  if (
    hints.lastProvider === "google" &&
    !userHasEmailPassword(hints.providers)
  ) {
    return `This account last signed in with ${formatProviderLabel("google")}. Use Continue with Google, then set a password under Account → Security if you want email sign-in.`;
  }

  if (fallbackMessage.includes("Invalid login credentials")) {
    return fallbackMessage;
  }

  return formatAccountExistsMessage(hints.providers, hints.lastProvider);
}
