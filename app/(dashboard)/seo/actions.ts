'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

export async function saveSeoDefaults(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.saveSeoDefaults.mutate(input);
  if (result.ok) revalidatePath('/seo');
  return result;
}
