export function formatAuthError(error: { message?: string; code?: string }): string {
  const message = error.message?.toLowerCase() ?? "";
  const code = error.code?.toLowerCase() ?? "";

  if (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    code === "user_already_exists"
  ) {
    return "An account with this email already exists. Sign in instead, or use Google if you registered that way.";
  }

  if (
    message.includes("invalid login credentials") ||
    code === "invalid_credentials"
  ) {
    return "Email or password is incorrect. If you signed up with Google, use Continue with Google instead.";
  }

  if (message.includes("email not confirmed")) {
    return "Check your inbox and confirm your email before signing in.";
  }

  if (message.includes("password") && message.includes("weak")) {
    return "Choose a stronger password — at least 8 characters.";
  }

  if (message.includes("rate limit") || code === "over_email_send_rate_limit") {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  return error.message ?? "Something went wrong. Please try again.";
}
