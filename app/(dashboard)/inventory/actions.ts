'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

export async function adjustStock(input: unknown): Promise<ActionResult<{ stockQty: number }>> {
  const result = await (await api()).operations.adjustStock.mutate(input);
  if (result.ok) {
    revalidatePath('/inventory');
    revalidatePath('/products');
  }
  return result;
}
