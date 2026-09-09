import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon, SlidersHorizontalIcon, AlertCircleIcon } from 'lucide-react';
import { api } from '@/lib/api/server';
import { METAFIELD_TYPE_SPECS } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Custom fields' };

export default async function MetafieldsPage() {
  await requireAdmin();
  const definitions = await (await api()).catalog.metafieldDefinitions.query();
  const needsReview = definitions.filter((definition) => definition.autoCreated).length;

  return (
    <PageContainer>
      <PageHeader
        title="Custom fields"
        subtitle="Reusable fields like Grade, Sheet thickness or Gauge."
        actions={
          <Button asChild>
            <Link href="/metafields/new">
              <PlusIcon className="size-4" />
              Add field
            </Link>
          </Button>
        }
      />

      {needsReview > 0 && (
        <Alert className="mb-4 border-[var(--warning-fg)]/25 bg-[var(--warning-bg)]">
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="text-[var(--warning-fg)]">
            {needsReview} field{needsReview === 1 ? ' was' : 's were'} created automatically during
            a CSV import with a guessed type. Open and save {needsReview === 1 ? 'it' : 'them'} to
            confirm.
          </AlertDescription>
        </Alert>
      )}

      {definitions.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <SlidersHorizontalIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <div className="flex flex-col gap-1">
            <p className="font-medium">No custom fields yet</p>
            <p className="text-muted-foreground max-w-[420px]">
              Define a field once — Grade, Sheet thickness, Gauge — and fill it in on every
              product. Fields round-trip through CSV import and export.
            </p>
          </div>
          <Button asChild className="mt-1">
            <Link href="/metafields/new">
              <PlusIcon className="size-4" />
              Add your first field
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          {definitions.map((definition) => {
            const used = definition.valueCount;
            return (
              <li key={definition.id} className="border-b last:border-b-0">
                <Link
                  href={`/metafields/${definition.id}`}
                  className="hover:bg-muted/40 flex items-center gap-3 px-3 py-2.5 transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{definition.nameEn}</span>
                      {definition.autoCreated && (
                        <span className="shrink-0 rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--warning-fg)]">
                          Review
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground block truncate font-mono text-xs">
                      {definition.namespace}.{definition.key}
                    </span>
                  </span>

                  <span className="text-muted-foreground hidden w-[150px] shrink-0 text-xs sm:block">
                    {METAFIELD_TYPE_SPECS[definition.type].label}
                  </span>

                  <span className="text-muted-foreground tabular hidden w-[90px] shrink-0 text-right text-xs md:block">
                    {used} value{used === 1 ? '' : 's'}
                  </span>

                  {definition.isFilterable && (
                    <span className="hidden shrink-0 rounded-full bg-[var(--info-bg)] px-2 py-0.5 text-xs font-medium text-[var(--info-fg)] lg:block">
                      Filterable
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
