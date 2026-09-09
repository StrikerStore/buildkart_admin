'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

/**
 * A page can be linked from a menu, so saving one invalidates the menu screens
 * too — the builder shows page titles, and a stale one is a link labelled with
 * a name the page no longer has.
 */
function revalidatePages() {
  revalidatePath('/pages', 'layout');
  revalidatePath('/menus');
}

export async function savePage(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).content.savePage.mutate(input);
  if (result.ok) revalidatePages();
  return result;
}

export async function setPagePublished(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.setPagePublished.mutate(input);
  if (result.ok) revalidatePages();
  return result;
}

export async function deletePage(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.deletePage.mutate(input);
  if (result.ok) revalidatePages();
  return result;
}

export async function reorderPages(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.reorderPages.mutate(input);
  if (result.ok) revalidatePath('/pages');
  return result;
}
