'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

export async function updateMediaAltText(id: string, input: unknown): Promise<ActionResult> {
  const result = await (await api()).operations.updateMediaAltText.mutate({ id, input });
  if (result.ok) revalidatePath('/media');
  return result;
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  const result = await (await api()).operations.deleteMedia.mutate({ id });
  if (result.ok) revalidatePath('/media');
  return result;
}

export async function deleteManyMedia(
  ids: string[],
): Promise<ActionResult<{ deleted: number; blocked: string[] }>> {
  const result = await (await api()).operations.deleteManyMedia.mutate({ ids });
  if (result.ok) revalidatePath('/media');
  return result;
}
