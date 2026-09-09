'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

/**
 * Thin wrappers over `backend/api`.
 *
 * The permission, the rules and the audit row are all on the far side; this app
 * no longer reaches the database for any of it. What remains is Next's: run the
 * mutation, and invalidate the caches this app renders from.
 */
export async function saveBanner(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).content.saveBanner.mutate(input);
  if (result.ok) revalidatePath('/banners');
  return result;
}

export async function setBannerActive(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.setBannerActive.mutate(input);
  if (result.ok) revalidatePath('/banners');
  return result;
}

export async function deleteBanner(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.deleteBanner.mutate(input);
  if (result.ok) revalidatePath('/banners');
  return result;
}

export async function reorderBanners(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.reorderBanners.mutate(input);
  if (result.ok) revalidatePath('/banners');
  return result;
}
