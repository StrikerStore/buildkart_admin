'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';
import type { RuleTagOption } from '@/components/categories/CategoryRuleBuilder';

/**
 * Creates a tag from inside the rule builder, so a rule can name a tag no
 * product carries yet.
 *
 * The slug is read back rather than derived here: `createTag` suffixes it when
 * the plain slug is taken, and a rule pointing at a guessed slug would quietly
 * gather the wrong tag's products.
 */
export async function createRuleTag(nameEn: string): Promise<ActionResult<RuleTagOption>> {
  const client = await api();
  const result = await client.catalog.createTag.mutate({ nameEn });
  if (!result.ok) return result;

  const created = await client.catalog.tagForm.query({ id: result.data.id });
  if (!created) return actionError('The tag was created but could not be read back. Reload the page.');

  revalidatePath('/tags');
  revalidatePath('/categories');
  const { slug, scope } = created.initial;
  return actionOk({ id: result.data.id, slug, nameEn: created.initial.nameEn, scope });
}

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
