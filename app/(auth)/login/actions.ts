'use server';

import { cookies } from 'next/headers';
import { actionErrorFromZod, loginSchema } from '@StrikerStore/contract';
import { apiClient, apiErrorCode } from '@/lib/api/client';
import {
  CHALLENGE_COOKIE,
  challengeCookieOptions,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/auth/cookie';
import { qrSvg } from '@/lib/qr';

/**
 * Why a wrong password and a lockout are different things.
 *
 * `auth.login` already throws UNAUTHORIZED for one and TOO_MANY_REQUESTS for the
 * other, and this action used to flatten both into a single string — so the form
 * had to either treat a lockout as a typo or sniff the wording to tell. Naming
 * the kind keeps that knowledge where it is used.
 *
 * `expired` is the second step's: the half-finished sign-in can no longer be
 * finished, and the form goes back to the password.
 */
export type LoginFailureKind = 'validation' | 'credentials' | 'rate-limited' | 'unavailable' | 'expired';

type Failure = {
  ok: false;
  kind: LoginFailureKind;
  formErrors: string[];
  fieldErrors: Record<string, string>;
};

/** What comes after a right password: in, the code from the app, or setting the app up. */
export type SignInStep = 'done' | 'totp' | 'enrol';

export type LoginResult = { ok: true; next: SignInStep } | Failure;

function fail(kind: LoginFailureKind, message: string): Failure {
  return { ok: false, kind, formErrors: [message], fieldErrors: {} };
}

/** The API's refusal as the form's kind of failure. */
function failureFrom(error: unknown, fallback: LoginFailureKind): Failure {
  // The API's own message is already the one to show, in every named case.
  const message = error instanceof Error ? error.message : '';
  switch (apiErrorCode(error)) {
    case 'TOO_MANY_REQUESTS':
      // `core/auth.ts` builds this from its own window, so it names the wait.
      return fail('rate-limited', message || 'Too many failed attempts. Try again shortly.');
    case 'UNAUTHORIZED':
      // One message for "no such account" and "wrong password", deliberately:
      // telling them apart tells an attacker which emails are real.
      return fail(fallback, message || 'Incorrect email or password.');
    case 'PRECONDITION_FAILED':
      return fail('expired', message || 'That sign-in has expired. Enter your password again.');
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

async function startSession(session: { token: string; expiresInSeconds: number }): Promise<void> {
  const cookieStore = await cookies();
  // The cookie lives exactly as long as the token it holds.
  cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresInSeconds));
  cookieStore.delete(CHALLENGE_COOKIE);
}

async function challenge(): Promise<string | null> {
  return (await cookies()).get(CHALLENGE_COOKIE)?.value ?? null;
}

/**
 * Signing in.
 *
 * The password is checked by `backend/api`, which is the only holder of the
 * signing key — this app cannot mint a session and no longer tries. What is
 * left here is genuinely Next's: validate the form, and put what the API
 * returned into an httpOnly cookie — the session, or, when a second step is
 * owed, the challenge that step will exchange for one.
 *
 * It returns `LoginResult` rather than the shared `ActionResult` because that
 * type has nowhere to put the failure kind, and widening it would mean a rebuild
 * and a version bump of a package the storefront consumes too — for one form.
 */
export async function login(input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    // `actionErrorFromZod` is typed `ActionResult<never>`, and that collapses to
    // the failure branch alone — so this spread needs no narrowing and no cast.
    return { ...actionErrorFromZod(parsed.error), kind: 'validation' };
  }

  try {
    const result = await apiClient().auth.login.mutate(parsed.data);
    if (result.step === 'done') {
      await startSession(result);
      return { ok: true, next: 'done' };
    }
    (await cookies()).set(CHALLENGE_COOKIE, result.challenge, challengeCookieOptions(result.expiresInSeconds));
    return { ok: true, next: result.step };
  } catch (error) {
    return failureFrom(error, 'credentials');
  }
}

/** The code from the authenticator app, or a recovery code. */
export async function submitSecondFactor(code: string): Promise<LoginResult> {
  const token = await challenge();
  if (!token) return fail('expired', 'That sign-in has expired. Enter your password again.');
  try {
    await startSession(await apiClient().auth.secondFactor.mutate({ challenge: token, code }));
    return { ok: true, next: 'done' };
  } catch (error) {
    return failureFrom(error, 'credentials');
  }
}

export type EnrolmentSetup = { secret: string; account: string; uri: string; qr: string };

/** An owner setting up the app at sign-in: the QR code to scan, and the key to type instead. */
export async function startEnrolment(): Promise<{ ok: true; setup: EnrolmentSetup } | Failure> {
  const token = await challenge();
  if (!token) return fail('expired', 'That sign-in has expired. Enter your password again.');
  try {
    const setup = await apiClient().auth.enrolStart.mutate({ challenge: token });
    return { ok: true, setup: { ...setup, qr: await qrSvg(setup.uri) } };
  } catch (error) {
    return failureFrom(error, 'credentials');
  }
}

/** The first code from the newly set-up app: signed in, with the recovery codes to keep. */
export async function finishEnrolment(code: string): Promise<{ ok: true; recoveryCodes: string[] } | Failure> {
  const token = await challenge();
  if (!token) return fail('expired', 'That sign-in has expired. Enter your password again.');
  try {
    const result = await apiClient().auth.enrolFinish.mutate({ challenge: token, code });
    await startSession(result);
    return { ok: true, recoveryCodes: result.recoveryCodes };
  } catch (error) {
    return failureFrom(error, 'credentials');
  }
}

/** Back to the password: the half-finished sign-in is dropped. */
export async function cancelSignIn(): Promise<void> {
  (await cookies()).delete(CHALLENGE_COOKIE);
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
