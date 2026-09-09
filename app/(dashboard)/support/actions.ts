'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@buildkart/contract';
import { api } from '@/lib/api/server';

/**
 * The inbox ordering, the badge count and the thread all change when a message
 * is sent, so both paths are revalidated. `/support` covers the list and the
 * count in the sidebar; the detail path covers the thread the owner is looking
 * at.
 */
function revalidateTicket(input: unknown) {
  const id = (input as { ticketId?: unknown } | null)?.ticketId;
  revalidatePath('/support');
  if (typeof id === 'string') revalidatePath('/support/' + id);
}

export async function replyToTicket(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).support.reply.mutate(input);
  if (result.ok) revalidateTicket(input);
  return result;
}

export async function setTicketStatus(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).support.setStatus.mutate(input);
  if (result.ok) revalidateTicket(input);
  return result;
}

/**
 * No revalidation: this changes a timestamp nothing on screen renders. Marking
 * a thread read should not make the page it was read on re-fetch itself.
 */
export async function markTicketRead(input: unknown): Promise<ActionResult<void>> {
  return (await api()).support.markRead.mutate(input);
}

export async function saveCannedReply(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).support.saveCannedReply.mutate(input);
  if (result.ok) revalidatePath('/support/replies');
  return result;
}

export async function deleteCannedReply(input: unknown): Promise<ActionResult<void>> {
  const result = await (await api()).support.deleteCannedReply.mutate(input);
  if (result.ok) revalidatePath('/support/replies');
  return result;
}
