import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { QuoteMaterialsManager } from '@/components/quote/QuoteMaterialsManager';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Quote materials' };

export default async function QuoteMaterialsPage() {
  await requirePermission('catalog:write');
  const form = await (await api()).catalog.quoteMaterials.query();

  return (
    <PageContainer narrow>
      <PageHeader
        title="Quote materials"
        subtitle="Which products the website's Get a quote calculator can offer, and how much one of each covers. A material with nothing linked is shown with its quantity and “ask for a rate”."
      />
      <QuoteMaterialsManager form={form} />
    </PageContainer>
  );
}
