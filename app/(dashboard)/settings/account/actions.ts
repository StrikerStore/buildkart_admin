'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/cookie';
import { qrSvg } from '@/lib/qr';

export async function updateProfile(input: unknown): Promise<ActionResult<{ name: string }>> {
  const result = await (await api()).auth.updateProfile.mutate(input);
  if (result.ok) {
    // The name is in the top bar of every screen, not just this one.
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Changing the password, and keeping this browser signed in.
 *
 * The API bumped `sessionVersion`, so the cookie in this browser is now as dead
 * as the ones on every other device — that is the point of the feature. It hands
 * back a replacement minted against the new version, and swapping the cookie for
 * it here is what makes "signs out every other device" mean *other*.
 */
export async function changePassword(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).auth.changePassword.mutate(input);
  if (!result.ok) return result;

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    result.data.token,
    sessionCookieOptions(result.data.expiresInSeconds),
  );

  return { ok: true };
}

export type TwoFactorSetup = { secret: string; account: string; qr: string };

/** Step one of turning two-step sign-in on, or of moving it to a new phone. Behind the password. */
export async function beginTwoFactor(input: unknown): Promise<ActionResult<TwoFactorSetup>> {
  const result = await (await api()).auth.twoFactorBegin.mutate(input);
  if (!result.ok) return result;
  return { ok: true, data: { secret: result.data.secret, account: result.data.account, qr: await qrSvg(result.data.uri) } };
}

/**
 * Step two: the code from the new app. The API ended every other session —
 * including any from before it was on — and handed back one for this browser,
 * swapped in here as with a password change.
 */
export async function confirmTwoFactor(input: unknown): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const result = await (await api()).auth.twoFactorConfirm.mutate(input);
  if (!result.ok) return result;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.data.token, sessionCookieOptions(result.data.expiresInSeconds));
  return { ok: true, data: { recoveryCodes: result.data.recoveryCodes } };
}

export async function newRecoveryCodes(input: unknown): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  return (await api()).auth.twoFactorRecoveryCodes.mutate(input);
}

export async function turnOffTwoFactor(input: unknown): Promise<ActionResult<void>> {
  return (await api()).auth.twoFactorDisable.mutate(input);
}
