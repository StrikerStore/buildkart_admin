import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentAdmin } from '@/lib/auth/requireAdmin';
import { SESSION_COOKIE } from '@/lib/auth/cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A streaming proxy, not a handler.
 *
 * The download itself lives on the API — it is the only thing with a database —
 * but a browser following an `<a href>` cannot present a service token, so it
 * cannot call the API directly. This route holds the credentials, forwards the
 * request, and pipes the response body straight through.
 *
 * Piping matters: the body is a stream, so a large catalogue is never held in
 * memory here. That is the whole reason the export stayed a plain HTTP route
 * instead of becoming a tRPC procedure.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await context.params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const base = (process.env.API_URL ?? '').replace(/\/$/, '');
  const upstream = await fetch(`${base}/imports/${encodeURIComponent(id)}/issues.csv`, {
    headers: {
      'x-service-token': process.env.SERVICE_TOKEN ?? '',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  if (upstream.status === 404) {
    return NextResponse.json({ error: 'Import not found.' }, { status: 404 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Could not build the report.' }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'text/csv; charset=utf-8',
      'content-disposition':
        upstream.headers.get('content-disposition') ?? 'attachment; filename="issues.csv"',
      'cache-control': 'no-store',
    },
  });
}
