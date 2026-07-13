const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  email: "Email and password",
  apple: "Apple",
  github: "GitHub",
};

export function formatProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function formatProviderList(providers: string[]): string {
  const labels = [...new Set(providers.map(formatProviderLabel))];
  if (labels.length === 0) return "your previous sign-in method";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
}

export function formatAccountExistsMessage(
  providers: string[],
  lastProvider?: string | null,
): string {
  const options = formatProviderList(providers);

  if (lastProvider) {
    return `An account with this email already exists. You last signed in with ${formatProviderLabel(lastProvider)}. Sign in with ${options}.`;
  }

  return `An account with this email already exists. Sign in with ${options}.`;
}

export function userHasEmailPassword(providers: string[]): boolean {
  return providers.includes("email");
}

interface PasswordLoginUser {
  identities?: { provider: string }[] | null;
  user_metadata?: Record<string, unknown> | null;
}

export function userHasPasswordLogin(
  providers: string[],
  user?: PasswordLoginUser | null,
): boolean {
  if (userHasEmailPassword(providers)) return true;
  return user?.user_metadata?.has_password === true;
}

export function getSecurityStateFromUser(user: PasswordLoginUser | null | undefined) {
  const providers = user?.identities?.map((identity) => identity.provider) ?? [];
  return {
    providers,
    hasPasswordLogin: userHasPasswordLogin(providers, user),
  };
}
