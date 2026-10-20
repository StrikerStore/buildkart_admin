'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

/** A request that came by phone, email or post, into the queue with its deadline. */
export async function recordPrivacyRequest(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).privacy.recordRequest.mutate(input);
  if (result.ok) revalidatePath('/privacy');
  return result;
}

/** Moving a request along, or closing it with what was done. */
export async function updatePrivacyRequest(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).privacy.updateRequest.mutate(input);
  if (result.ok) {
    revalidatePath('/privacy');
    // The sidebar badge counts open requests.
    revalidatePath('/', 'layout');
  }
  return result;
}

/** Carrying out a deletion request now. Refused while an order is open or money is owed. */
export async function eraseNow(id: string): Promise<ActionResult<void>> {
  const result = await (await api()).privacy.eraseNow.mutate({ id });
  if (result.ok) {
    revalidatePath('/privacy');
    revalidatePath('/customers', 'layout');
    revalidatePath('/', 'layout');
  }
  return result;
}
