import { NextResponse, type NextRequest } from 'next/server';
import { api } from '@/lib/api/server';
import { getCurrentAdmin } from '@/lib/auth/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The thread poll.
 *
 * A route handler rather than a Server Action, for the same reason the import
 * progress poll is one: polling wants a plain GET the client can fire cheaply
 * and abort, not a POST that Next treats as a mutation and serialises against
 * other actions. Actions are for writes; this is a read that happens often.
 *
 * `after` is the caller's newest message id — a ULID, so "greater than" means
 * "newer than". Omitting it returns the whole thread, which is what a client
 * that has lost its place does.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await context.params;
  const after = request.nextUrl.searchParams.get('after') ?? undefined;

  const thread = await (await api()).support.thread.query({ ticketId: id, afterId: after });
  if (!thread) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json(thread, { headers: { 'Cache-Control': 'no-store' } });
}
