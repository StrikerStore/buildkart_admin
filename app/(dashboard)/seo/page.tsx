import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { SeoDefaultsForm } from '@/components/content/SeoDefaultsForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Search engine' };

export default async function SeoPage() {
  await requirePermission('content:write');

  const client = await api();
  const [seo, { store }] = await Promise.all([
    client.content.seoDefaults.query(),
    client.content.settings.query(),
  ]);

  return (
    <PageContainer narrow>
      <PageHeader
        title="Search engine"
        subtitle="The title and description search engines show for the shop."
      />
      <SeoDefaultsForm initial={seo} storeName={store.nameEn} />
    </PageContainer>
  );
}
