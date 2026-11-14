'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

import type {
  CustomerLookupResult,
  DistanceQuote,
  PincodeQuote,
  PlaceSuggestionDto,
  VariantSearchResult,
} from '@StrikerStore/contract';

export type { CustomerLookupResult, DistanceQuote, PlaceSuggestionDto, VariantSearchResult };

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

/** What the dropped pin adds to each item and to the delivery, priced as the order will be. */
export async function quoteDistance(input: unknown): Promise<ActionResult<DistanceQuote>> {
  return (await api()).orders.quoteDistance.query(input);
}

/*
 * The storefront's own place search, so a colony typed here lands where the
 * checkout's search would put it. Both only move the map; the pin is what the
 * order keeps. Failures are an empty list, not an error: the map still works.
 */
export async function searchPlaces(
  query: string,
  sessionToken?: string,
): Promise<PlaceSuggestionDto[]> {
  if (query.trim().length < 3) return [];
  try {
    return await (await api()).storefront.searchPlaces.query({ q: query, sessionToken });
  } catch {
    return [];
  }
}

export async function placeLocation(
  placeId: string,
  sessionToken?: string,
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    return await (await api()).storefront.placeLocation.query({ placeId, sessionToken });
  } catch {
    return null;
  }
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
