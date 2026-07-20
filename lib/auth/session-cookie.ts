export function hasSupabaseAuthCookie(
  cookies: ReadonlyArray<{ name: string }>,
): boolean {
  return cookies.some(
    ({ name }) => name.startsWith("sb-") && name.includes("-auth-token"),
  );
}
