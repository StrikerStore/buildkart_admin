'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

export async function createCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).catalog.createCategory.mutate(input);
  if (result.ok) revalidatePath('/categories');
  return result;
}

export async function updateCategory(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).catalog.updateCategory.mutate({ id, input });
  if (result.ok) revalidatePath('/categories');
  return result;
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  const result = await (await api()).catalog.setCategoryActive.mutate({ id, isActive });
  if (result.ok) revalidatePath('/categories');
  return result;
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const result = await (await api()).catalog.deleteCategory.mutate({ id });
  if (result.ok) revalidatePath('/categories');
  return result;
}

export async function reorderCategories(input: unknown): Promise<ActionResult> {
  const result = await (await api()).catalog.reorderCategories.mutate(input);
  if (result.ok) revalidatePath('/categories');
  return result;
}
