import type { Metadata } from 'next';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { WarehouseTable } from '@/components/delivery/WarehouseTable';
import { requirePermission } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Warehouses' };

export default async function WarehousesPage() {
  await requirePermission('delivery:write');
  const rows = await (await api()).operations.warehouses.query();

  const live = rows.filter((row) => row.isActive).length;

  return (
    <PageContainer>
      <PageHeader
        title="Warehouses"
        subtitle={
          rows.length > 0
            ? `${live} serving orders, ${rows.length} listed`
            : 'Where orders ship from, and how far that is.'
        }
      />
      <div className="flex flex-col gap-4">
        <WarehouseTable rows={rows} />
      </div>
    </PageContainer>
  );
}
