'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { LoaderCircleIcon, PackageSearchIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { WarehouseStockRowDto } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  loadWarehouseStock,
  saveWarehouseStock,
} from '@/app/(dashboard)/delivery/actions';
import { cn } from '@/lib/utils';

/**
 * What one warehouse holds.
 *
 * Paged and searched rather than listed whole: a builders' merchant carries
 * thousands of variants, and a screen that loads all of them is a screen nobody
 * opens twice. Only edited rows are sent, so paging away from a change and back
 * does not quietly rewrite the rest of the catalogue to zero.
 */
export function WarehouseStockEditor({
  warehouseId,
  initial,
  initialCursor,
}: {
  warehouseId: string;
  initial: WarehouseStockRowDto[];
  initialCursor: string | null;
}) {
  const [rows, setRows] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [search, setSearch] = useState('');
  /** variantId -> the quantity typed, as a string while it is being typed. */
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();

  // Skips the debounced reload on first render, which would throw away the
  // page the server already rendered.
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      startLoading(async () => {
        const page = await loadWarehouseStock({
          warehouseId,
          ...(search.trim() ? { search: search.trim() } : {}),
        });
        setRows(page.rows);
        setCursor(page.nextCursor);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, warehouseId]);

  function loadMore() {
    if (!cursor) return;
    startLoading(async () => {
      const page = await loadWarehouseStock({
        warehouseId,
        cursor,
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      setRows((current) => [...current, ...page.rows]);
      setCursor(page.nextCursor);
    });
  }

  const edits = Object.entries(dirty);

  function save() {
    if (edits.length === 0) return;
    startSaving(async () => {
      const result = await saveWarehouseStock({
        warehouseId,
        rows: edits.map(([variantId, quantity]) => ({
          variantId,
          quantity: quantity === '' ? 0 : Number(quantity),
        })),
      });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not save those quantities.');
        return;
      }
      // Fold the saved values into the rows so the "changed" marks clear
      // without a round trip that would also lose the admin's scroll position.
      setRows((current) =>
        current.map((row) =>
          dirty[row.variantId] === undefined
            ? row
            : { ...row, quantity: Number(dirty[row.variantId] || 0) },
        ),
      );
      setDirty({});
      toast.success(`${result.data.saved} item${result.data.saved === 1 ? '' : 's'} saved`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or SKU"
            className="pl-9"
          />
        </div>
        <Button type="button" disabled={edits.length === 0 || isSaving} onClick={save}>
          {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
          {edits.length === 0 ? 'Save changes' : `Save ${edits.length} change${edits.length === 1 ? '' : 's'}`}
        </Button>
      </div>

      <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
        <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium sm:flex">
          <span className="min-w-0 flex-1">Product</span>
          <span className="w-[110px] shrink-0 text-right">Sellable</span>
          <span className="w-[130px] shrink-0 text-right">Held here</span>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <PackageSearchIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
            <p className="font-medium">Nothing matches</p>
            <p className="text-muted-foreground max-w-[380px]">
              {search.trim()
                ? 'Try a different product name or SKU.'
                : 'There are no active products to stock yet.'}
            </p>
          </div>
        ) : (
          <ul>
            {rows.map((row) => {
              const typed = dirty[row.variantId];
              const changed = typed !== undefined;
              return (
                <li
                  key={row.variantId}
                  className={cn(
                    'flex flex-wrap items-center gap-3 border-b px-3 py-2.5 last:border-b-0',
                    changed && 'bg-[var(--info-bg)]',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {row.productName}
                      {row.variantLabel && (
                        <span className="text-muted-foreground"> · {row.variantLabel}</span>
                      )}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {row.sku ?? 'No SKU'}
                      {row.unitLabel && ` · per ${row.unitLabel}`}
                    </span>
                  </span>

                  <span className="tabular text-muted-foreground w-[110px] shrink-0 text-right text-xs">
                    {row.sellableStockQty}
                  </span>

                  <span className="w-[130px] shrink-0">
                    <Input
                      value={typed ?? String(row.quantity)}
                      onChange={(e) => {
                        const next = e.target.value.replace(/\D/g, '');
                        setDirty((current) => {
                          // Typing a value back to what it already was is not a
                          // change, and should not count towards the save.
                          if (next === String(row.quantity)) {
                            const { [row.variantId]: _removed, ...rest } = current;
                            return rest;
                          }
                          return { ...current, [row.variantId]: next };
                        });
                      }}
                      inputMode="numeric"
                      className="tabular text-right"
                      aria-label={`Quantity of ${row.productName} held here`}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {cursor && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" disabled={isLoading} onClick={loadMore}>
            {isLoading && <LoaderCircleIcon className="size-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
