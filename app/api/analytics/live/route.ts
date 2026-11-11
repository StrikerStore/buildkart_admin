import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { can } from '@StrikerStore/contract';
import { getCurrentAdmin } from '@/lib/auth/requireAdmin';
import { SESSION_COOKIE } from '@/lib/auth/cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The live visitor count for `<LiveNow>`, which polls it every few seconds.
 *
 * A proxy for the API's `GET /analytics/live`, like the products export: the
 * browser cannot present the service token, so this route holds it. Plain
 * JSON rather than a tRPC call, so the card needed no contract release. The
 * API checks the permission again; this check just avoids the round trip.
 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!can(admin.role, 'orders:read')) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const base = (process.env.API_URL ?? '').replace(/\/$/, '');
  try {
    const upstream = await fetch(`${base}/analytics/live`, {
      headers: {
        'x-service-token': process.env.SERVICE_TOKEN ?? '',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });
    const body: unknown = await upstream.json().catch(() => ({ error: 'Bad response.' }));
    return NextResponse.json(body, {
      status: upstream.ok ? 200 : upstream.status,
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the API.' }, { status: 502 });
  }
}
