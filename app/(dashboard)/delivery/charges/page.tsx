import type { Metadata } from 'next';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { DeliveryChargesForm } from '@/components/delivery/DeliveryChargesForm';
import { requirePermission } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Delivery charges' };

export default async function DeliveryChargesPage() {
  await requirePermission('delivery:write');
  const client = await api();
  const [settings, warehouses] = await Promise.all([
    client.content.settings.query(),
    client.operations.warehouses.query(),
  ]);

  return (
    <PageContainer narrow>
      <PageHeader
        title="Delivery charges"
        subtitle="What delivery costs on products priced the same everywhere: a base by cart total, plus distance. Products priced by distance deliver free — set them on the product."
      />
      <DeliveryChargesForm
        initial={settings.deliveryCharges}
        activeWarehouses={warehouses.filter((warehouse) => warehouse.isActive).length}
      />
    </PageContainer>
  );
}
