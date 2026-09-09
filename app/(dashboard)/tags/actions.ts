'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

/** Tags drive product badges and category rules, so all three lists move. */
function revalidateAll() {
  revalidatePath('/tags');
  revalidatePath('/products');
  revalidatePath('/categories');
}

export async function createTag(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).catalog.createTag.mutate(input);
  if (result.ok) revalidateAll();
  return result;
}

export async function updateTag(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).catalog.updateTag.mutate({ id, input });
  if (result.ok) revalidateAll();
  return result;
}

export async function deleteTag(id: string): Promise<ActionResult> {
  const result = await (await api()).catalog.deleteTag.mutate({ id });
  if (result.ok) revalidateAll();
  return result;
}

export async function mergeTags(
  sourceId: string,
  targetId: string,
): Promise<ActionResult<{ moved: number }>> {
  const result = await (await api()).catalog.mergeTags.mutate({ sourceId, targetId });
  if (result.ok) revalidateAll();
  return result;
}
