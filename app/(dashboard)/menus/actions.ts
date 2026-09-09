'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

export async function saveMenu(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.saveMenu.mutate(input);
  if (result.ok) revalidatePath('/menus');
  return result;
}
