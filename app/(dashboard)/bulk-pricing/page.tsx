import type { Metadata } from 'next';
import Link from 'next/link';
import { LayersIcon } from 'lucide-react';
import { api } from '@/lib/api/server';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { BulkTiersTable } from '@/components/rates/BulkTiersTable';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Bulk rates' };

export default async function BulkPricingPage() {
  await requireAdmin();
  const rows = await (await api()).operations.bulkTiers.query();

  return (
    <PageContainer>
      <PageHeader
        title="Bulk rates"
        subtitle={
          rows.length > 0
            ? 'Price breaks that apply automatically, per line. Change what you need and save once.'
            : undefined
        }
      />

      {rows.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <LayersIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <div className="flex flex-col gap-1">
            <p className="font-medium">Nothing to retune yet</p>
            <p className="text-muted-foreground max-w-[440px]">
              Products show up here once they have a bulk ladder, or once they are marked
              “Price changes daily”. Set the first ladder on a product’s own page.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-1">
            <Link href="/products">Open products</Link>
          </Button>
        </div>
      ) : (
        <BulkTiersTable rows={rows} />
      )}
    </PageContainer>
  );
}
