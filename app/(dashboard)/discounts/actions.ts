'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

export async function saveDiscount(
  input: unknown,
): Promise<ActionResult<{ id: string; code: string | null }>> {
  const result = await (await api()).operations.saveDiscount.mutate(input);
  if (result.ok) revalidatePath('/discounts');
  return result;
}

export async function setDiscountActive(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).operations.setDiscountActive.mutate(input);
  if (result.ok) revalidatePath('/discounts');
  return result;
}

export async function deleteDiscount(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).operations.deleteDiscount.mutate(input);
  if (result.ok) revalidatePath('/discounts');
  return result;
}
