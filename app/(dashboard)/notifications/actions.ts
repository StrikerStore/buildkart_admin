'use server';

import { revalidatePath } from 'next/cache';
import type {
  ActionResult,
  WhatsappTemplateStatusDto,
  WhatsappTestDto,
} from '@StrikerStore/contract';
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

export async function submitWhatsappTemplate(
  input: unknown,
): Promise<ActionResult<WhatsappTemplateStatusDto>> {
  const result = await (await api()).notifications.submitWhatsappTemplate.mutate(input);
  if (result.ok) revalidatePath('/notifications');
  return result;
}

export async function refreshWhatsappTemplate(
  input: unknown,
): Promise<ActionResult<WhatsappTemplateStatusDto>> {
  const result = await (await api()).notifications.refreshWhatsappTemplate.mutate(input);
  if (result.ok) revalidatePath('/notifications');
  return result;
}

export async function sendWhatsappTest(input: unknown): Promise<ActionResult<WhatsappTestDto>> {
  return (await api()).notifications.sendWhatsappTest.mutate(input);
}
