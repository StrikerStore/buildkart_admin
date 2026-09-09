import { NextResponse } from 'next/server';
import { apiClient } from '@/lib/api/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Is this app able to serve?
 *
 * That no longer means "can I reach MySQL" — this app has no database. It means
 * "can I reach the API", which is the only thing standing between it and every
 * piece of data it renders. An API outage looks like a mass logout from the
 * outside, so a probe that reports it plainly is worth having.
 */
export async function GET() {
  try {
    // A public procedure, so this works without a session.
    await apiClient().content.settings.query();
    return NextResponse.json({ ok: true, api: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, api: 'error', error: error instanceof Error ? error.message : String(error) },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
