import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/cookie';

/**
 * Edge guard. Next 16's `proxy.ts` — the successor to `middleware.ts`.
 *
 * It checks that a session cookie is *present*, and nothing more.
 *
 * It used to verify the signature too. From Phase 4 it cannot: the signing key
 * lives only in `backend/api`, and handing this app a copy so the edge could
 * check a signature would undo the reason the key was moved. Nothing is lost —
 * this was always documented as a fast redirect for humans rather than the
 * security boundary, and the boundary is now genuinely the API, which verifies
 * the signature *and* confirms the account is still live.
 *
 * A forged or expired cookie therefore gets past this and is refused a
 * millisecond later by `requireAdmin`. That is the correct division: the edge
 * saves an anonymous visitor a wasted render, it does not decide anything.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSessionCookie) {
    // API routes get JSON, not a redirect. A fetch() follows redirects silently,
    // so bouncing an XHR to the login page hands the caller a 200 full of HTML
    // instead of an error it can act on.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    // Preserve where they were headed so login can return them there. Only the
    // path and query travel, never an absolute URL — an attacker-supplied host
    // would turn the login form into an open redirect.
    if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Everything except: the login route and its action, the health check and
   * cron endpoints (which authenticate with a bearer secret rather than a
   * cookie), Next's own assets, and static files.
   */
  matcher: ['/((?!login|api/auth|api/health|api/cron|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
