'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

export async function saveAnnouncementBar(input: unknown): Promise<ActionResult> {
  const result = await (await api()).content.saveAnnouncementBar.mutate(input);
  if (result.ok) revalidatePath('/announcements');
  return result;
}
