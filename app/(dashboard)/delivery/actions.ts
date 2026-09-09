'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

/** The new-order form prefills its delivery charge from these. */
function revalidateAreas() {
  revalidatePath('/delivery/pincodes');
  revalidatePath('/orders/new');
}

export async function savePincode(
  input: unknown,
): Promise<ActionResult<{ id: string; pincode: string }>> {
  const result = await (await api()).operations.savePincode.mutate(input);
  if (result.ok) revalidateAreas();
  return result;
}

export async function deletePincode(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).operations.deletePincode.mutate(input);
  if (result.ok) revalidateAreas();
  return result;
}

export async function markRequestsNotified(
  input: unknown,
): Promise<ActionResult<{ notified: number }>> {
  const result = await (await api()).operations.markRequestsNotified.mutate(input);
  if (result.ok) revalidatePath('/delivery/requests');
  return result;
}
