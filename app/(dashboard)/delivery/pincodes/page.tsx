import type { Metadata } from 'next';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { PincodeTable } from '@/components/delivery/PincodeTable';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Serviceable pincodes' };

export default async function PincodesPage() {
  await requireAdmin();
  const rows = await (await api()).operations.pincodes.query();

  const live = rows.filter((row) => row.isActive).length;

  return (
    <PageContainer>
      <PageHeader
        title="Serviceable pincodes"
        subtitle={
          rows.length > 0
            ? `${live} area${live === 1 ? '' : 's'} delivering, ${rows.length} listed`
            : 'Where BuildKart delivers, and what it costs.'
        }
      />
      <div className="flex flex-col gap-4">
        <PincodeTable rows={rows} />
      </div>
    </PageContainer>
  );
}
