'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckIcon, ChevronDownIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  formatINR,
  validateTierLadder,
  type BulkTierRowDto,
  type PriceTierDraft,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PriceTierEditor } from '@/components/products/PriceTierEditor';
import { cn } from '@/lib/utils';
import { saveBulkTiers } from '@/app/(dashboard)/bulk-pricing/actions';

/**
 * Retuning bulk ladders, the way Today's Rates retunes prices.
 *
 * Same discipline: a local draft, only the changed rows sent, and the server
 * re-diffs anyway. The difference is shape — a rate is one number and a ladder
 * is a list, so a row here cannot be one tab stop. Forty variants at three
 * rungs each would be 240 inputs on screen at once, which is not a morning
 * routine, so rows render as a one-line summary and open on tap.
 */
export function BulkTiersTable({ rows }: { rows: BulkTierRowDto[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, PriceTierDraft[]>>(() =>
    Object.fromEntries(rows.map((row) => [row.variantId, row.tiers.map((tier) => ({ ...tier }))])),
  );
  const [open, setOpen] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const original = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.variantId, row])),
    [rows],
  );

  /** Compared as text, against the props the server normalised on the way out. */
  const changed = useMemo(
    () =>
      rows.filter((row) => {
        const value = draft[row.variantId];
        if (!value) return false;
        return JSON.stringify(strip(value)) !== JSON.stringify(strip(row.tiers));
      }),
    [rows, draft],
  );

  /*
   * The same validator the server runs, against the same stored list price.
   * Mirrored here because the server rejects the whole save on one bad ladder,
   * and losing a screen of retuning to a typo three rows down is a bad trade.
   */
  const invalid = changed.filter((row) => {
    const value = draft[row.variantId];
    return value ? validateTierLadder(row.basis, row.price, value).length > 0 : false;
  });

  function onSave() {
    if (changed.length === 0) {
      toast.info('Nothing changed yet.');
      return;
    }
    if (invalid.length > 0) {
      toast.error(`${invalid.length} ladder${invalid.length === 1 ? '' : 's'} need fixing.`);
      return;
    }

    startSaving(async () => {
      const result = await saveBulkTiers({
        changes: changed.map((row) => ({
          variantId: row.variantId,
          tiers: strip(draft[row.variantId]!),
        })),
      });

      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not save the ladders.');
        return;
      }
      toast.success(
        `${result.data.updated} ladder${result.data.updated === 1 ? '' : 's'} updated`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-card sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-[var(--shadow-card)]">
        <span className="text-muted-foreground text-sm">
          {changed.length > 0
            ? `${changed.length} change${changed.length === 1 ? '' : 's'} pending`
            : `${rows.filter((r) => r.tiers.length > 0).length} of ${rows.length} have a ladder`}
        </span>

        <div className="flex-1" />

        <Button type="button" onClick={onSave} disabled={isSaving || changed.length === 0}>
          {isSaving ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          Save {changed.length > 0 ? changed.length : ''}
        </Button>
      </div>

      <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
        <ul>
          {rows.map((row) => {
            const tiers = draft[row.variantId] ?? [];
            const before = original[row.variantId]!;
            const isChanged =
              JSON.stringify(strip(tiers)) !== JSON.stringify(strip(before.tiers));
            const isOpen = open === row.variantId;
            const problems = validateTierLadder(row.basis, row.price, tiers);

            return (
              <li
                key={row.variantId}
                className={cn('border-b last:border-b-0', isChanged && 'bg-[var(--info-bg)]')}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : row.variantId)}
                  className="hover:bg-muted/40 flex w-full items-center gap-3 px-3 py-2 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{row.productName}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {[row.variantLabel, row.sku].filter(Boolean).join(' · ') ||
                        row.unitLabel ||
                        ''}
                    </span>
                  </span>

                  <span className="tabular text-muted-foreground hidden w-[90px] shrink-0 text-right text-sm sm:block">
                    {formatINR(row.price)}
                  </span>

                  <span className="tabular text-muted-foreground hidden min-w-0 flex-1 truncate text-xs md:block">
                    {tiers.length === 0 ? 'No ladder' : summarise(row, tiers)}
                  </span>

                  {problems.length > 0 && (
                    <span className="shrink-0 text-xs text-[var(--critical-fg)]">needs fixing</span>
                  )}

                  <ChevronDownIcon
                    className={cn(
                      'text-muted-foreground size-4 shrink-0 transition-transform',
                      isOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>

                {isOpen && (
                  <div className="border-t px-3 py-3">
                    <PriceTierEditor
                      basis={row.basis}
                      listPrice={row.price}
                      tiers={tiers}
                      onTiersChange={(next) =>
                        setDraft((current) => ({ ...current, [row.variantId]: next }))
                      }
                    />
                    <p className="text-muted-foreground mt-2 text-xs">
                      <Link href={`/products/${row.productId}`} className="underline">
                        Open the product
                      </Link>{' '}
                      to change the price or how these breaks are measured.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-muted-foreground px-1 text-xs">
        Only the {changed.length} changed ladder{changed.length === 1 ? '' : 's'} will be saved.
      </p>
    </div>
  );
}

/** Rows as they are compared and sent — ids and blanks are not part of the value. */
function strip(tiers: readonly PriceTierDraft[]): Array<{ threshold: string; unitPrice: string }> {
  return tiers
    .filter((tier) => tier.threshold.trim() !== '' || tier.unitPrice.trim() !== '')
    .map((tier) => ({ threshold: tier.threshold.trim(), unitPrice: tier.unitPrice.trim() }));
}

/** "20+ ₹370 · 40+ ₹365", or the amount equivalent. */
function summarise(row: BulkTierRowDto, tiers: readonly PriceTierDraft[]): string {
  return tiers
    .map((tier) => {
      const at = row.basis === 'QUANTITY' ? `${tier.threshold || '?'}+` : `>${tier.threshold || '?'}`;
      return `${at} ₹${tier.unitPrice || '?'}`;
    })
    .join(' · ');
}
