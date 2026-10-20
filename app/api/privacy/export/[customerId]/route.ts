import { NextResponse } from 'next/server';
import { can } from '@StrikerStore/contract';
import { getCurrentAdmin } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Everything held about one customer, as a JSON file — for answering a
 * request that came by phone or email (DPDP Act §11).
 *
 * Owner only, checked here for a clean refusal and again by the API, which
 * also writes the download to the audit log.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!can(admin.role, 'privacy:manage')) {
    return NextResponse.json({ error: 'Only the owner can download customer data.' }, { status: 403 });
  }

  const { customerId } = await params;
  const data = await (await api()).privacy.customerExport.query({ customerId });
  if (!data) return NextResponse.json({ error: 'No such customer.' }, { status: 404 });

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="customer-${data.profile.phone}-${day}.json"`,
      'cache-control': 'no-store, private',
    },
  });
}
