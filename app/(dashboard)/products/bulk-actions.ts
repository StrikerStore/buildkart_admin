'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

export async function bulkEditTags(
  input: unknown,
): Promise<ActionResult<{ added: number; removed: number; products: number }>> {
  const result = await (await api()).catalog.bulkEditTags.mutate(input);
  if (result.ok) revalidatePath('/products');
  return result;
}

export async function bulkSetStatus(input: unknown): Promise<ActionResult<{ updated: number }>> {
  const result = await (await api()).catalog.bulkSetStatus.mutate(input);
  if (result.ok) revalidatePath('/products');
  return result;
}
