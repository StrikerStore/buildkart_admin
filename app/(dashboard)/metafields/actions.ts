'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

/** The product form renders these fields, so it moves with the definitions. */
function revalidateAll() {
  revalidatePath('/metafields');
  revalidatePath('/products');
}

export async function createMetafieldDefinition(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).catalog.createMetafield.mutate(input);
  if (result.ok) revalidateAll();
  return result;
}

export async function updateMetafieldDefinition(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).catalog.updateMetafield.mutate({ id, input });
  if (result.ok) revalidateAll();
  return result;
}

export async function deleteMetafieldDefinition(id: string): Promise<ActionResult> {
  const result = await (await api()).catalog.deleteMetafield.mutate({ id });
  if (result.ok) revalidateAll();
  return result;
}
