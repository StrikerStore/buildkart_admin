'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

function revalidateBlog() {
  revalidatePath('/blog', 'layout');
  // A post can be linked from a menu, whose builder lists post titles.
  revalidatePath('/menus');
}

export async function saveBlogPost(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).content.saveBlogPost.mutate(input);
  if (result.ok) revalidateBlog();
  return result;
}

export async function setBlogPostPublished(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.setBlogPostPublished.mutate(input);
  if (result.ok) revalidateBlog();
  return result;
}

export async function deleteBlogPost(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.deleteBlogPost.mutate(input);
  if (result.ok) revalidateBlog();
  return result;
}
