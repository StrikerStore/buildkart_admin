import { NextResponse, type NextRequest } from 'next/server';
import { api } from '@/lib/api/server';
import { getCurrentAdmin } from '@/lib/auth/requireAdmin';
import { UPLOAD_STATUS } from '@/lib/auth/httpStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Issues a presigned URL so the browser uploads straight to R2.
 *
 * Still a route handler rather than a server action because the uploader needs
 * a plain fetch. The presign itself happens on the API, which is the only
 * holder of the R2 credentials now.
 */
export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const result = await (await api()).operations.presignMedia.mutate(
    await request.json().catch(() => null),
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: UPLOAD_STATUS[result.reason] });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
