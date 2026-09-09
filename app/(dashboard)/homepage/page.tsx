import type { Metadata } from 'next';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { HomepageManager } from '@/components/content/HomepageManager';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Homepage sections' };

export default async function HomepagePage() {
  await requireAdmin();
  const client = await api();

  // Two calls, one HTTP request: the batch link collapses them.
  const [rows, options] = await Promise.all([
    client.content.homepageSections.query(),
    client.content.homepageSectionOptions.query(),
  ]);

  const live = rows.filter((row) => row.isActive).length;

  return (
    <PageContainer>
      <PageHeader
        title="Homepage sections"
        subtitle={
          rows.length > 0
            ? `${live} showing of ${rows.length}, top to bottom`
            : 'What the storefront home page is made of, in order.'
        }
      />
      <div className="flex flex-col gap-4">
        <HomepageManager
          rows={rows}
          categories={options.categories}
          products={options.products}
          tags={options.tags}
        />
      </div>
    </PageContainer>
  );
}
