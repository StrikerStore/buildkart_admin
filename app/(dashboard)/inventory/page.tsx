import type { Metadata } from 'next';
import Link from 'next/link';
import { PackageIcon } from 'lucide-react';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Inventory' };

const FILTERS = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'all', label: 'All tracked' },
] as const;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const filter = raw.filter === 'all' ? 'all' : 'attention';

  const { all, needsAttention, outCount, lowCount, recentAdjustments } =
    await (await api()).operations.inventory.query();
  const rows = filter === 'all' ? all : needsAttention;

  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        subtitle={
          outCount > 0 || lowCount > 0
            ? `${outCount} out of stock, ${lowCount} running low`
            : 'Everything is above its alert level.'
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1 border-b">
          {FILTERS.map((tab) => (
            <Link
              key={tab.value}
              href={tab.value === 'attention' ? '/inventory' : '/inventory?filter=all'}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 font-medium transition-colors',
                filter === tab.value
                  ? 'border-[var(--nav)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {tab.label}
              {tab.value === 'attention' && needsAttention.length > 0 && (
                <span className="text-muted-foreground ml-1.5 text-xs">
                  {needsAttention.length}
                </span>
              )}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
            <PackageIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
            <p className="font-medium">
              {filter === 'attention' ? 'Nothing needs attention' : 'Nothing is tracked yet'}
            </p>
            <p className="text-muted-foreground max-w-[420px]">
              {filter === 'attention'
                ? 'Every tracked product is above its low-stock alert level.'
                : 'Turn on “Track quantity” on a product to see it here.'}
            </p>
          </div>
        ) : (
          <InventoryTable rows={rows} />
        )}

        {recentAdjustments.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Recent movements</h2>
            <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
              {recentAdjustments.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 border-b px-3 py-2 text-xs last:border-b-0"
                >
                  <span
                    className={cn(
                      'tabular w-12 shrink-0 text-right font-medium',
                      entry.delta > 0 ? 'text-[var(--success-fg)]' : 'text-[var(--critical-fg)]',
                    )}
                  >
                    {entry.delta > 0 ? '+' : ''}
                    {entry.delta}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {entry.productName}
                    {entry.sku && (
                      <span className="text-muted-foreground"> · {entry.sku}</span>
                    )}
                  </span>
                  <span className="text-muted-foreground hidden min-w-0 flex-1 truncate sm:block">
                    {entry.note ?? entry.reason.toLowerCase()}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {new Date(entry.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
