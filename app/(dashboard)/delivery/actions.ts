'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

/** The new-order form prefills its delivery charge from these. */
function revalidateAreas() {
  revalidatePath('/delivery/pincodes');
  revalidatePath('/orders/new');
}

export async function savePincode(
  input: unknown,
): Promise<ActionResult<{ id: string; pincode: string }>> {
  const result = await (await api()).operations.savePincode.mutate(input);
  if (result.ok) revalidateAreas();
  return result;
}

export async function deletePincode(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).operations.deletePincode.mutate(input);
  if (result.ok) revalidateAreas();
  return result;
}

export async function markRequestsNotified(
  input: unknown,
): Promise<ActionResult<{ notified: number }>> {
  const result = await (await api()).operations.markRequestsNotified.mutate(input);
  if (result.ok) revalidatePath('/delivery/requests');
  return result;
}

/*
 * Warehouses change what a cart costs to deliver, so the pages that quote a
 * charge are refreshed alongside the list itself.
 */
function revalidateWarehouses() {
  revalidatePath('/delivery/warehouses');
  revalidatePath('/delivery/charges');
  revalidatePath('/orders/new');
}

export async function saveWarehouse(
  input: unknown,
): Promise<ActionResult<{ id: string; code: string }>> {
  const result = await (await api()).operations.saveWarehouse.mutate(input);
  if (result.ok) revalidateWarehouses();
  return result;
}

export async function deleteWarehouse(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).operations.deleteWarehouse.mutate(input);
  if (result.ok) revalidateWarehouses();
  return result;
}

export async function saveWarehouseStock(
  input: unknown,
): Promise<ActionResult<{ saved: number }>> {
  const result = await (await api()).operations.saveWarehouseStock.mutate(input);
  if (result.ok) revalidateWarehouses();
  return result;
}

export async function saveDistancePricing(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).operations.saveDistancePricing.mutate(input);
  if (result.ok) revalidateWarehouses();
  return result;
}

/**
 * One page of the stock editor.
 *
 * A server action rather than a route handler because the editor pages and
 * searches as the admin types, and this keeps that on the same authenticated
 * path as everything else on the screen.
 */
export async function loadWarehouseStock(input: {
  warehouseId: string;
  search?: string;
  cursor?: string;
}) {
  return (await api()).operations.warehouseStock.query(input);
}

export async function saveUnloadingService(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).operations.saveUnloadingService.mutate(input);
  if (result.ok) revalidatePath('/delivery/unloading');
  return result;
}
