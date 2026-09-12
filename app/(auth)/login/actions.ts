'use server';

import { cookies } from 'next/headers';
import { actionErrorFromZod, loginSchema } from '@StrikerStore/contract';
import { apiClient, apiErrorCode } from '@/lib/api/client';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/cookie';

/**
 * Why a wrong password and a lockout are different things.
 *
 * `auth.login` already throws UNAUTHORIZED for one and TOO_MANY_REQUESTS for the
 * other, and this action used to flatten both into a single string — so the form
 * had to either treat a lockout as a typo or sniff the wording to tell. Naming
 * the kind keeps that knowledge where it is used.
 */
export type LoginFailureKind = 'validation' | 'credentials' | 'rate-limited' | 'unavailable';

export type LoginResult =
  | { ok: true }
  | {
      ok: false;
      kind: LoginFailureKind;
      formErrors: string[];
      fieldErrors: Record<string, string>;
    };

function fail(kind: LoginFailureKind, message: string): LoginResult {
  return { ok: false, kind, formErrors: [message], fieldErrors: {} };
}

/**
 * Signing in.
 *
 * The password is checked by `backend/api`, which is the only holder of the
 * signing key — this app cannot mint a session and no longer tries. What is
 * left here is genuinely Next's: validate the form, and put the token the API
 * returned into an httpOnly cookie.
 *
 * It returns `LoginResult` rather than the shared `ActionResult` because that
 * type has nowhere to put the failure kind, and widening it would mean a rebuild
 * and a version bump of a package the storefront consumes too — for one form.
 *
 * The success branch carries no payload on purpose. The old `redirectTo` was
 * never read: the client navigates to its own sanitised `next`, which is the
 * only version an open-redirect check can vouch for.
 */
export async function login(input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    // `actionErrorFromZod` is typed `ActionResult<never>`, and that collapses to
    // the failure branch alone — so this spread needs no narrowing and no cast.
    return { ...actionErrorFromZod(parsed.error), kind: 'validation' };
  }

  try {
    const session = await apiClient().auth.login.mutate(parsed.data);

    const cookieStore = await cookies();
    // The cookie lives exactly as long as the token it holds.
    cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresInSeconds));

    return { ok: true };
  } catch (error) {
    // The API's own message is already the one to show, in both named cases.
    const message = error instanceof Error ? error.message : '';

    switch (apiErrorCode(error)) {
      case 'TOO_MANY_REQUESTS':
        // `core/auth.ts` builds this from its own window, so it names the wait.
        return fail('rate-limited', message || 'Too many failed attempts. Try again shortly.');

      case 'UNAUTHORIZED':
        // One message for "no such account" and "wrong password", deliberately:
        // telling them apart tells an attacker which emails are real.
        return fail('credentials', message || 'Incorrect email or password.');

      default:
        /*
         * Worth its own kind rather than folding into the line above.
         * `getCurrentAdmin()` reports an API outage as "not signed in", so an
         * outage renders this form and then fails the submit — and a shop owner
         * told "incorrect password" will retype a password that was right.
         */
        console.error('[login] the API call failed', error);
        return fail('unavailable', 'Could not sign in right now. Try again in a moment.');
    }
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
