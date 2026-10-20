'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult, IncidentAudienceCountDto } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

/** A breach, recorded the moment it is known: the 72-hour clock runs from "found out". */
export async function createIncident(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await (await api()).privacy.createIncident.mutate(input);
  if (result.ok) revalidatePath('/incidents');
  return result;
}

export async function updateIncident(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).privacy.updateIncident.mutate(input);
  if (result.ok) revalidatePath('/incidents', 'layout');
  return result;
}

/** How many a notice would reach, before anyone presses Send. */
export async function countIncidentAudience(input: unknown): Promise<ActionResult<IncidentAudienceCountDto>> {
  return (await api()).privacy.incidentAudienceCount.mutate(input);
}

/** Starts the notices going out; the page shows the count as they do. */
export async function sendIncidentNotices(input: unknown): Promise<ActionResult<IncidentAudienceCountDto>> {
  const result = await (await api()).privacy.sendIncidentNotices.mutate(input);
  if (result.ok) revalidatePath('/incidents', 'layout');
  return result;
}
