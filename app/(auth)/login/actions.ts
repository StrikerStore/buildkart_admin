'use server';

import { cookies } from 'next/headers';
import { actionError, actionErrorFromZod, actionOk, loginSchema, type ActionResult } from '@buildkart/contract';
import { apiClient, apiErrorCode } from '@/lib/api/client';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/cookie';

/**
 * Signing in.
 *
 * The password is checked by `backend/api`, which is the only holder of the
 * signing key — this app cannot mint a session and no longer tries. What is
 * left here is genuinely Next's: validate the form, and put the token the API
 * returned into an httpOnly cookie.
 */
export async function login(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return actionErrorFromZod(parsed.error);

  try {
    const session = await apiClient().auth.login.mutate(parsed.data);

    const cookieStore = await cookies();
    // The cookie lives exactly as long as the token it holds.
    cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresInSeconds));

    return actionOk({ redirectTo: '/' });
  } catch (error) {
    const code = apiErrorCode(error);
    if (code === 'UNAUTHORIZED' || code === 'TOO_MANY_REQUESTS') {
      // The API's message is already the one to show: a single generic failure
      // for bad credentials, or the rate-limit wording with its wait time.
      return actionError(error instanceof Error ? error.message : 'Incorrect email or password.');
    }

    console.error('[login] the API call failed', error);
    return actionError('Could not sign in right now. Try again in a moment.');
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
