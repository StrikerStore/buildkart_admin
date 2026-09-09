'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

export async function duplicateProduct(
  productId: string,
): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).catalog.duplicateProduct.mutate({ id: productId });
  if (result.ok) revalidatePath('/products');
  return result;
}
