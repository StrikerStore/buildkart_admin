import { NextResponse, type NextRequest } from 'next/server';
import { api } from '@/lib/api/server';
import { getCurrentAdmin } from '@/lib/auth/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Media browser for the image picker, fetched on demand by the client. */
export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const page = await (await api()).operations.mediaPicker.query({
    q: searchParams.get('q')?.trim() ?? '',
    cursor: searchParams.get('cursor') ?? undefined,
  });

  return NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } });
}
