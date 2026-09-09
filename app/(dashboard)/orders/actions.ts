'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

import type { OrderStatus } from '@StrikerStore/contract';

/** Both order views change on every write, so they revalidate together. */
function revalidateOrder(input: unknown) {
  const id = (input as { orderId?: unknown } | null)?.orderId;
  revalidatePath('/orders');
  if (typeof id === 'string') revalidatePath('/orders/' + id);
}

export async function advanceOrderStatus(
  input: unknown,
): Promise<ActionResult<{ status: OrderStatus }>> {
  const result = await (await api()).orders.advanceStatus.mutate(input);
  if (result.ok) revalidateOrder(input);
  return result;
}

export async function cancelOrder(input: unknown): Promise<ActionResult<{ restocked: number }>> {
  const result = await (await api()).orders.cancel.mutate(input);
  if (result.ok) {
    revalidateOrder(input);
    // A restock moves stock counts, which two other screens render.
    revalidatePath('/inventory');
    revalidatePath('/products');
  }
  return result;
}

export async function saveOrderNote(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).orders.saveNote.mutate(input);
  if (result.ok) revalidateOrder(input);
  return result;
}

export async function recordPaymentTransaction(
  input: unknown,
): Promise<ActionResult<{ paymentStatus: string; outstanding: string }>> {
  const result = await (await api()).orders.recordPayment.mutate(input);
  if (result.ok) revalidateOrder(input);
  return result;
}

export async function deletePaymentTransaction(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).orders.deletePayment.mutate(input);
  if (result.ok) revalidateOrder(input);
  return result;
}
