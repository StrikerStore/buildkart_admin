'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

export async function saveRates(
  input: unknown,
): Promise<ActionResult<{ updated: number; unchanged: number }>> {
  const result = await (await api()).operations.saveRates.mutate(input);
  // Only revalidate when something actually moved: a save that changed nothing
  // should not blow the product list out of cache.
  if (result.ok && result.data.updated > 0) {
    revalidatePath('/rates');
    revalidatePath('/products');
  }
  return result;
}
