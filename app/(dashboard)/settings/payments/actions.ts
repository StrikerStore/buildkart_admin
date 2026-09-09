'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

/**
 * Thin wrappers, as everywhere else: the permission, the encryption and the
 * audit row all live on the far side.
 *
 * Note what these do *not* do — they never receive a stored credential, only a
 * newly typed one on its way in. The read path has nothing to return that would
 * need scrubbing here.
 */
export async function savePaymentProvider(input: unknown): Promise<ActionResult> {
  const result = await (await api()).payments.saveProvider.mutate(input);
  if (result.ok) {
    revalidatePath('/settings/payments');
    // The Settings landing page summarises which methods are on.
    revalidatePath('/settings');
  }
  return result;
}

export async function reorderPaymentProviders(input: unknown): Promise<ActionResult> {
  const result = await (await api()).payments.reorderProviders.mutate(input);
  if (result.ok) revalidatePath('/settings/payments');
  return result;
}
