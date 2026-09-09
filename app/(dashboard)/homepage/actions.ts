'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

export async function saveHomepageSection(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).content.saveHomepageSection.mutate(input);
  if (result.ok) revalidatePath('/homepage');
  return result;
}

export async function setHomepageSectionActive(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.setHomepageSectionActive.mutate(input);
  if (result.ok) revalidatePath('/homepage');
  return result;
}

export async function deleteHomepageSection(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.deleteHomepageSection.mutate(input);
  if (result.ok) revalidatePath('/homepage');
  return result;
}

export async function reorderHomepageSections(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.reorderHomepageSections.mutate(input);
  if (result.ok) revalidatePath('/homepage');
  return result;
}
