import type { Metadata } from 'next';
import { discountState } from '@buildkart/contract';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { DiscountsManager } from '@/components/discounts/DiscountsManager';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Discounts' };

export default async function DiscountsPage() {
  await requireAdmin();
  const { discounts: rows, options } = await (await api()).operations.discounts.query();

  const live = rows.filter(
    (row) =>
      discountState({
        isActive: row.isActive,
        startsAt: new Date(row.startsAt),
        endsAt: row.endsAt ? new Date(row.endsAt) : null,
        usageLimit: row.usageLimit,
        usageCount: row.usageCount,
      }) === 'ACTIVE',
  ).length;

  return (
    <PageContainer>
      <PageHeader
        title="Discounts"
        subtitle={
          rows.length > 0
            ? `${live} running now, ${rows.length} in total`
            : 'Codes customers enter, and discounts that apply on their own.'
        }
      />
      <div className="flex flex-col gap-4">
        <DiscountsManager
          rows={rows}
          categories={options.categories}
          products={options.products}
          tags={options.tags}
        />
      </div>
    </PageContainer>
  );
}
