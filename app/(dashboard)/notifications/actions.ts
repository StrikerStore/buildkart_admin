'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

export async function saveNotificationTemplate(input: unknown): Promise<ActionResult> {
  const result = await (await api()).notifications.saveTemplate.mutate(input);
  if (result.ok) revalidatePath('/notifications');
  return result;
}

export async function deleteNotificationTemplate(input: unknown): Promise<ActionResult> {
  const result = await (await api()).notifications.deleteTemplate.mutate(input);
  if (result.ok) revalidatePath('/notifications');
  return result;
}

export async function saveSmsProvider(input: unknown): Promise<ActionResult> {
  const result = await (await api()).notifications.saveSmsProvider.mutate(input);
  if (result.ok) revalidatePath('/notifications');
  return result;
}

export async function saveWhatsappProvider(input: unknown): Promise<ActionResult> {
  const result = await (await api()).notifications.saveWhatsappProvider.mutate(input);
  if (result.ok) revalidatePath('/notifications');
  return result;
}

export async function saveEmailProvider(input: unknown): Promise<ActionResult> {
  const result = await (await api()).notifications.saveEmailProvider.mutate(input);
  if (result.ok) revalidatePath('/notifications');
  return result;
}
