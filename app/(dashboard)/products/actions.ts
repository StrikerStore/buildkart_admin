'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

function revalidateProducts(id?: string) {
  revalidatePath('/products');
  if (id) revalidatePath(`/products/${id}`);
}

export async function createProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).catalog.createProduct.mutate(input);
  if (result.ok) revalidateProducts(result.data.id);
  return result;
}

export async function updateProduct(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string; deactivated: number }>> {
  const result = await (await api()).catalog.updateProduct.mutate({ id, input });
  if (result.ok) revalidateProducts(id);
  return result;
}

export async function setProductStatus(
  id: string,
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
): Promise<ActionResult> {
  const result = await (await api()).catalog.setProductStatus.mutate({ id, status });
  if (result.ok) revalidateProducts(id);
  return result;
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const result = await (await api()).catalog.deleteProduct.mutate({ id });
  if (result.ok) revalidateProducts();
  return result;
}
