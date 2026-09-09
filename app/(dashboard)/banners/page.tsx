import type { Metadata } from 'next';
import { api, serverConfig } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { BannersManager } from '@/components/content/BannersManager';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Banners' };

export default async function BannersPage() {
  await requireAdmin();
  const [rows, { media }] = await Promise.all([
    (await api()).content.banners.query(),
    serverConfig(),
  ]);

  const live = rows.filter((row) => row.isActive).length;

  return (
    <PageContainer>
      <PageHeader
        title="Banners"
        subtitle={
          rows.length > 0
            ? `${live} showing of ${rows.length}`
            : 'Artwork for the home page and the top of categories.'
        }
      />
      <div className="flex flex-col gap-4">
        <BannersManager rows={rows} ctx={media} />
      </div>
    </PageContainer>
  );
}
