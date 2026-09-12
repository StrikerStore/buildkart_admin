'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

export async function saveBulkTiers(
  input: unknown,
): Promise<ActionResult<{ updated: number; unchanged: number }>> {
  const result = await (await api()).operations.saveBulkTiers.mutate(input);
  // Only when something moved: a save that changed nothing should not blow the
  // product list out of cache.
  if (result.ok && result.data.updated > 0) {
    revalidatePath('/bulk-pricing');
    revalidatePath('/products');
  }
  return result;
}
