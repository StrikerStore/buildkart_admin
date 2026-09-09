'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

import type { CustomerLookupResult, PincodeQuote, VariantSearchResult } from '@buildkart/contract';

export type { CustomerLookupResult, VariantSearchResult };

export async function searchVariants(
  input: unknown,
): Promise<ActionResult<{ results: VariantSearchResult[] }>> {
  return (await api()).orders.searchVariants.query(input);
}

export async function lookupCustomer(input: unknown): Promise<ActionResult<CustomerLookupResult>> {
  return (await api()).orders.lookupCustomer.query(input);
}

export async function lookupPincode(pincode: unknown): Promise<ActionResult<PincodeQuote>> {
  return (await api()).orders.lookupPincode.query({ pincode: String(pincode ?? '') });
}

export async function createOrder(
  input: unknown,
): Promise<ActionResult<{ orderId: string; orderNumber: string; grandTotal: string }>> {
  const result = await (await api()).orders.create.mutate(input);
  if (result.ok) {
    revalidatePath('/orders');
    // Placing an order takes stock off the shelf, which two other screens show.
    revalidatePath('/inventory');
    revalidatePath('/products');
  }
  return result;
}
