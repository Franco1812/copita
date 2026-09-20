/**
 * Whether the request carries Supabase auth cookies. This is a hint, not proof:
 * it only decides which link the header shows and whether the proxy bothers
 * refreshing a session. Every real check still goes through `requireUser`.
 */
export function hasSessionCookie(all: readonly { name: string }[]) {
  return all.some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}
