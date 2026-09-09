'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

export async function saveStoreSettings(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.saveStoreSettings.mutate(input);
  if (result.ok) {
    revalidatePath('/settings');
    // The invoice letterhead and the order form both read these.
    revalidatePath('/orders', 'layout');
  }
  return result;
}

export async function saveCommerceSettings(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.saveCommerceSettings.mutate(input);
  if (result.ok) {
    revalidatePath('/settings');
    // The bulk cutoff changes what every new order costs.
    revalidatePath('/orders', 'layout');
    revalidatePath('/products');
  }
  return result;
}
