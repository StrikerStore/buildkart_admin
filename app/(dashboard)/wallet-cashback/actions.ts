'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

export async function saveWalletRules(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.saveWalletRules.mutate(input);
  if (result.ok) revalidatePath('/wallet-cashback');
  return result;
}
