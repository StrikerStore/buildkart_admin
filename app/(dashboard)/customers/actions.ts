'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

function revalidateCustomer(input: unknown) {
  const id = (input as { customerId?: unknown } | null)?.customerId;
  revalidatePath('/customers');
  if (typeof id === 'string') revalidatePath('/customers/' + id);
}

export async function updateCustomer(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).orders.updateCustomer.mutate(input);
  if (result.ok) revalidateCustomer(input);
  return result;
}

export async function adjustWallet(input: unknown): Promise<ActionResult<{ balance: string }>> {
  const result = await (await api()).orders.adjustWallet.mutate(input);
  if (result.ok) revalidateCustomer(input);
  return result;
}

export async function setCustomerBlocked(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).orders.setCustomerBlocked.mutate(input);
  if (result.ok) revalidateCustomer(input);
  return result;
}
