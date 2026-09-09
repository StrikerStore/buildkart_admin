'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

/**
 * Saving a rate can reprice every product on it, so the product screens are
 * invalidated too — otherwise a cached list would keep quoting the old rate
 * until something else happened to touch it.
 */
export async function saveTaxRate(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).catalog.saveTaxRate.mutate(input);
  if (result.ok) {
    revalidatePath('/settings/tax');
    revalidatePath('/products', 'layout');
  }
  return result;
}

export async function deleteTaxRate(input: unknown): Promise<ActionResult> {
  const result = await (await api()).catalog.deleteTaxRate.mutate(input);
  if (result.ok) revalidatePath('/settings/tax');
  return result;
}

export async function reorderTaxRates(input: unknown): Promise<ActionResult> {
  const result = await (await api()).catalog.reorderTaxRates.mutate(input);
  if (result.ok) revalidatePath('/settings/tax');
  return result;
}
