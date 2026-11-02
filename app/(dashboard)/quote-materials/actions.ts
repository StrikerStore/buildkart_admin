'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

export async function saveQuoteMaterial(input: {
  material: string;
  variantId: string;
  baseUnitsPerSaleUnit: string;
}): Promise<ActionResult<void>> {
  const result = await (await api()).catalog.saveQuoteMaterial.mutate(input);
  if (result.ok) revalidatePath('/quote-materials');
  return result;
}

export async function deleteQuoteMaterial(id: string): Promise<ActionResult<void>> {
  const result = await (await api()).catalog.deleteQuoteMaterial.mutate({ id });
  if (result.ok) revalidatePath('/quote-materials');
  return result;
}

export async function reorderQuoteMaterial(input: {
  material: string;
  ids: string[];
}): Promise<ActionResult<void>> {
  const result = await (await api()).catalog.reorderQuoteMaterial.mutate(input);
  if (result.ok) revalidatePath('/quote-materials');
  return result;
}
