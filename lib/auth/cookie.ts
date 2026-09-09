/**
 * The session cookie.
 *
 * Stays in the admin, not the API: a cookie is this browser's business, and the
 * API neither sets nor reads one — it takes a bearer token and has no opinion
 * about where the caller kept it.
 *
 * `maxAge` is not hardcoded. It comes from the token the API issued, so the
 * cookie and the token expire together — a cookie that outlives its token logs
 * someone out mid-click with no explanation, and one that dies first throws
 * away a session that was still good.
 */
export const SESSION_COOKIE = 'bk_admin_session';

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  } as const;
}
