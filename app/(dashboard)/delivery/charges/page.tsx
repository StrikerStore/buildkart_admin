import type { Metadata } from 'next';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { DistancePricingForm } from '@/components/delivery/DistancePricingForm';
import { requirePermission } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Delivery charges' };

export default async function DeliveryChargesPage() {
  await requirePermission('delivery:write');
  const settings = await (await api()).content.settings.query();

  return (
    <PageContainer narrow>
      <PageHeader
        title="Delivery charges"
        subtitle="What a delivery costs, worked out from the warehouse it leaves."
      />
      <DistancePricingForm initial={settings.distancePricing} />
    </PageContainer>
  );
}
