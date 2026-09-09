'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ImageIcon } from 'lucide-react';
import { buildMediaUrl, formatINR, ADMIN_THUMB } from '@StrikerStore/contract';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { TagBadge } from '@/components/tags/TagBadge';
import { ProductBulkBar, type BulkTagOption } from './ProductBulkBar';
import type { ProductListItemDto } from '@StrikerStore/contract';

function StatusPill({ status }: { status: ProductListItemDto['status'] }) {
  const styles = {
    ACTIVE: 'bg-[var(--success-bg)] text-[var(--success-fg)]',
    DRAFT: 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)]',
    ARCHIVED: 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
  } as const;
  const labels = { ACTIVE: 'Active', DRAFT: 'Draft', ARCHIVED: 'Archived' } as const;

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', styles[status])}>
      {labels[status]}
    </span>
  );
}

export function ProductListTable({
  products,
  allTags,
  publicBaseUrl,
  transformsEnabled,
}: {
  products: ProductListItemDto[];
  allTags: BulkTagOption[];
  publicBaseUrl: string | null;
  transformsEnabled: boolean;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // A selection that survives a filter change would apply an edit to products
  // no longer on screen, so it is cleared whenever the result set changes.
  useEffect(() => setChecked(new Set()), [products]);

  const allChecked = products.length > 0 && checked.size === products.length;
  const selectedIds = [...checked];

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.length > 0 ? (
        <ProductBulkBar
          selectedIds={selectedIds}
          allTags={allTags}
          onClear={() => setChecked(new Set())}
        />
      ) : (
        <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs">
          <Checkbox
            checked={allChecked}
            onCheckedChange={(v) =>
              setChecked(v ? new Set(products.map((p) => p.id)) : new Set())
            }
            aria-label="Select all products"
          />
          Select products to tag or change status in bulk.
        </div>
      )}

      <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
        {products.map((product) => {
          const thumb =
            product.thumbnailKey && publicBaseUrl
              ? buildMediaUrl(publicBaseUrl, transformsEnabled, product.thumbnailKey, {
                  w: ADMIN_THUMB,
                })
              : null;
          const isChecked = checked.has(product.id);

          return (
            <li
              key={product.id}
              className={cn(
                'flex items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0',
                isChecked ? 'bg-[var(--info-bg)]' : 'hover:bg-muted/40',
              )}
            >
              <span className="flex w-4 shrink-0 items-center">
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(v) =>
                    setChecked((current) => {
                      const next = new Set(current);
                      if (v) next.add(product.id);
                      else next.delete(product.id);
                      return next;
                    })
                  }
                  aria-label={`Select ${product.nameEn}`}
                />
              </span>

              <Link href={`/products/${product.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="bg-muted flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <ImageIcon className="text-muted-foreground size-4" strokeWidth={1.5} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{product.nameEn}</span>
                  <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="truncate">
                      {[product.brandName, product.categoryName].filter(Boolean).join(' · ') ||
                        'Uncategorised'}
                    </span>
                    {product.tags.slice(0, 3).map((tag) => (
                      <TagBadge
                        key={tag.id}
                        label={tag.nameEn}
                        tone={tag.badgeTone}
                        scope={tag.scope}
                      />
                    ))}
                    {product.tags.length > 3 && <span>+{product.tags.length - 3}</span>}
                  </span>
                </span>

                <span className="tabular hidden w-24 shrink-0 text-right sm:block">
                  {product.price ? formatINR(product.price) : '—'}
                </span>

                <span
                  className={cn(
                    'tabular hidden w-20 shrink-0 text-right text-xs md:block',
                    product.isLowStock
                      ? 'font-medium text-[var(--critical-fg)]'
                      : 'text-muted-foreground',
                  )}
                >
                  {product.stockQty} in stock
                </span>

                <StatusPill status={product.status} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
