'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

/**
 * Four wrappers for four tabs, mirroring the four mutations behind them: each
 * saves on its own, so an unfinished step order cannot block a wording change.
 */
export async function saveCheckoutFlow(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.saveCheckoutFlow.mutate(input);
  if (result.ok) revalidatePath('/checkout');
  return result;
}

export async function saveCheckoutFields(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.saveCheckoutFields.mutate(input);
  if (result.ok) revalidatePath('/checkout');
  return result;
}

export async function saveCheckoutContent(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.saveCheckoutContent.mutate(input);
  if (result.ok) revalidatePath('/checkout');
  return result;
}

export async function saveCheckoutDesign(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.saveCheckoutDesign.mutate(input);
  if (result.ok) revalidatePath('/checkout');
  return result;
}

export async function saveCheckoutLocation(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.saveCheckoutLocation.mutate(input);
  if (result.ok) revalidatePath('/checkout');
  return result;
}
