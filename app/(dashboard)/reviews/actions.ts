'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

/** Thin wrappers over `backend/api`, as `banners/actions.ts` is. */
export async function saveCustomerReview(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).content.saveCustomerReview.mutate(input);
  if (result.ok) revalidatePath('/reviews');
  return result;
}

export async function setCustomerReviewActive(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.setCustomerReviewActive.mutate(input);
  if (result.ok) revalidatePath('/reviews');
  return result;
}

export async function deleteCustomerReview(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.deleteCustomerReview.mutate(input);
  if (result.ok) revalidatePath('/reviews');
  return result;
}

export async function reorderCustomerReviews(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).content.reorderCustomerReviews.mutate(input);
  if (result.ok) revalidatePath('/reviews');
  return result;
}
