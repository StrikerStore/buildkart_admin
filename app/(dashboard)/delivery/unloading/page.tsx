import type { Metadata } from 'next';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { UnloadingServiceForm } from '@/components/delivery/UnloadingServiceForm';
import { requirePermission } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Unloading service' };

export default async function UnloadingServicePage() {
  await requirePermission('delivery:write');
  const settings = await (await api()).content.settings.query();

  return (
    <PageContainer narrow>
      <PageHeader
        title="Unloading service"
        subtitle="An optional flat fee customers can add in the cart, for unloading at the site."
      />
      <UnloadingServiceForm initial={settings.unloading} />
    </PageContainer>
  );
}
