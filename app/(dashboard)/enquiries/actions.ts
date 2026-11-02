'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

/** The layout too: the sidebar badge counts what this moves out of New. */
export async function updateEnquiry(input: {
  id: string;
  status: string;
  note: string;
}): Promise<ActionResult<void>> {
  const result = await (await api()).enquiries.update.mutate(input);
  if (result.ok) {
    revalidatePath('/enquiries');
    revalidatePath(`/enquiries/${input.id}`);
    revalidatePath('/', 'layout');
  }
  return result;
}
