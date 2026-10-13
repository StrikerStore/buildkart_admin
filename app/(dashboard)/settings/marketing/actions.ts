'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

/**
 * Thin wrappers, as everywhere else: the permission, the encryption and the
 * audit row all live on the far side. The token passes through here once, on
 * its way in, and is never read back.
 */
export async function saveMetaMarketing(input: unknown): Promise<ActionResult> {
  const result = await (await api()).marketing.saveMeta.mutate(input);
  if (result.ok) revalidatePath('/settings/marketing');
  return result;
}

/** One test Purchase, under the saved test code, to Events Manager → Test events. */
export async function sendMetaTest(): Promise<
  ActionResult<{ eventsReceived: number; traceId: string | null }>
> {
  const result = await (await api()).marketing.sendMetaTest.mutate();
  revalidatePath('/settings/marketing');
  return result;
}

/** Pulls the last seven days of Meta ad spend now, instead of at the next cron run. */
export async function syncMetaInsights(): Promise<
  ActionResult<{ rows: number; since: string; until: string }>
> {
  const result = await (await api()).marketing.syncMetaInsights.mutate();
  revalidatePath('/settings/marketing');
  revalidatePath('/analytics');
  return result;
}
