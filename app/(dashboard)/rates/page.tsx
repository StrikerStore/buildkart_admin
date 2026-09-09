import type { Metadata } from 'next';
import Link from 'next/link';
import { TrendingUpIcon } from 'lucide-react';
import { api } from '@/lib/api/server';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { RatesTable } from '@/components/rates/RatesTable';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Today’s Rates' };

export default async function RatesPage() {
  await requireAdmin();
  const rows = await (await api()).operations.rates.query();

  return (
    <PageContainer>
      <PageHeader
        title="Today’s Rates"
        subtitle={
          rows.length > 0
            ? `${rows.length} price${rows.length === 1 ? '' : 's'} that move daily. Change what you need and save once.`
            : undefined
        }
      />

      {rows.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <TrendingUpIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <div className="flex flex-col gap-1">
            <p className="font-medium">Nothing is marked as changing daily</p>
            <p className="text-muted-foreground max-w-[440px]">
              Turn on “Price changes daily” on a product, or “Prices change daily” on a category
              so every product in it follows automatically. Cement and sariya are the usual ones.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-1">
            <Link href="/categories">Open categories</Link>
          </Button>
        </div>
      ) : (
        <RatesTable rows={rows} />
      )}
    </PageContainer>
  );
}
