'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircleIcon, CheckIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MONEY_PATTERN, formatINR, normalizeMoney, toPaise, fromPaise } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { saveRates } from '@/app/(dashboard)/rates/actions';

export type RateRow = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  unitLabel: string | null;
  price: string;
  bulkPrice: string;
  /** The MRP, struck through on the storefront. Empty when there is none. */
  compareAtPrice: string;
  /** ISO date of the last price change, or null if never. */
  priceUpdatedAt: string | null;
};

/**
 * An MRP at or below the selling price is the one thing a struck-through
 * "was ₹410" must never be — it would advertise a saving that is not there.
 * The same rule the product form and the server both apply.
 */
function mrpBelowPrice(value: { price: string; compareAtPrice: string }): boolean {
  if (value.compareAtPrice === '') return false;
  if (!MONEY_PATTERN.test(value.compareAtPrice) || !MONEY_PATTERN.test(value.price)) return false;
  return toPaise(value.compareAtPrice) <= toPaise(value.price);
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const then = new Date(iso);
  const now = new Date();
  return (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  );
}

/**
 * The morning routine.
 *
 * Built around one measurement: how long it takes to change six cement prices
 * and be sure they saved. So every row is one tab stop, only edited rows are
 * sent, and the rows already done today are marked — the owner should be able
 * to see at a glance what is left rather than re-reading prices they already
 * updated.
 */
export function RatesTable({ rows }: { rows: RateRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<
    Record<string, { price: string; bulkPrice: string; compareAtPrice: string }>
  >(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.variantId,
        {
          price: r.price,
          bulkPrice: r.bulkPrice,
          /*
           * `?? ''` because the API may not send this yet. Admin and the API
           * deploy separately, and an undefined here would hand React an
           * uncontrolled input that silently stops tracking what is typed.
           */
          compareAtPrice: r.compareAtPrice ?? '',
        },
      ]),
    ),
  );
  const [isSaving, startSaving] = useTransition();

  // Bulk adjustment, for the days when everything moves together.
  const [adjustDirection, setAdjustDirection] = useState<'increase' | 'decrease'>('increase');
  const [adjustMode, setAdjustMode] = useState<'percent' | 'amount'>('percent');
  const [adjustAmount, setAdjustAmount] = useState('');

  const original = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.variantId, r])),
    [rows],
  );

  const changed = useMemo(
    () =>
      rows.filter((row) => {
        const value = draft[row.variantId];
        if (!value) return false;
        return (
          value.price !== row.price ||
          value.bulkPrice !== row.bulkPrice ||
          value.compareAtPrice !== (row.compareAtPrice ?? '')
        );
      }),
    [rows, draft],
  );

  const invalid = changed.filter((row) => {
    const value = draft[row.variantId]!;
    if (!MONEY_PATTERN.test(value.price)) return true;
    if (value.bulkPrice !== '' && !MONEY_PATTERN.test(value.bulkPrice)) return true;
    if (value.compareAtPrice !== '' && !MONEY_PATTERN.test(value.compareAtPrice)) return true;
    // Caught here as well as on the server, because the server rejects the
    // whole save and the owner would lose a screen of typing to one bad row.
    if (mrpBelowPrice(value)) return true;
    return false;
  });

  function set(
    variantId: string,
    field: 'price' | 'bulkPrice' | 'compareAtPrice',
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      [variantId]: { ...current[variantId]!, [field]: value },
    }));
  }

  function applyBulk() {
    const numeric = Number(adjustAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    setDraft((current) => {
      const next = { ...current };
      for (const row of rows) {
        const value = next[row.variantId]!;
        if (!MONEY_PATTERN.test(value.price)) continue;

        const paise = toPaise(value.price);
        const delta =
          adjustMode === 'percent'
            ? Math.round((paise * numeric) / 100)
            : toPaise(normalizeMoney(adjustAmount));
        const updated = adjustDirection === 'increase' ? paise + delta : Math.max(0, paise - delta);
        next[row.variantId] = { ...value, price: fromPaise(updated) };
      }
      return next;
    });
    setAdjustAmount('');
  }

  function onSave() {
    if (changed.length === 0) {
      toast.info('Nothing changed yet.');
      return;
    }
    if (invalid.length > 0) {
      toast.error(`${invalid.length} price${invalid.length === 1 ? '' : 's'} not a valid amount.`);
      return;
    }

    startSaving(async () => {
      const result = await saveRates({
        changes: changed.map((row) => ({
          variantId: row.variantId,
          price: normalizeMoney(draft[row.variantId]!.price),
          bulkPrice: draft[row.variantId]!.bulkPrice,
          compareAtPrice: draft[row.variantId]!.compareAtPrice,
        })),
      });

      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not save the rates.');
        return;
      }
      toast.success(
        `${result.data.updated} rate${result.data.updated === 1 ? '' : 's'} updated`,
      );
      router.refresh();
    });
  }

  if (rows.length === 0) return null;

  const doneToday = rows.filter((r) => isToday(r.priceUpdatedAt)).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Sticky so Save is never more than a glance away on a long list. */}
      <div className="bg-card sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-[var(--shadow-card)]">
        <span className="font-medium">
          {changed.length > 0
            ? `${changed.length} change${changed.length === 1 ? '' : 's'} pending`
            : `${doneToday} of ${rows.length} updated today`}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <Select
            value={adjustDirection}
            onValueChange={(v) => setAdjustDirection(v as typeof adjustDirection)}
          >
            <SelectTrigger className="h-8 w-[104px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="increase">Raise all</SelectItem>
              <SelectItem value="decrease">Cut all</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyBulk();
              }
            }}
            inputMode="decimal"
            placeholder="0"
            className="tabular h-8 w-16"
          />

          <Select value={adjustMode} onValueChange={(v) => setAdjustMode(v as typeof adjustMode)}>
            <SelectTrigger className="h-8 w-[68px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">%</SelectItem>
              <SelectItem value="amount">₹</SelectItem>
            </SelectContent>
          </Select>

          <Button type="button" variant="outline" size="sm" onClick={applyBulk}>
            Apply
          </Button>
        </div>

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
        <div className="text-muted-foreground bg-muted/40 flex items-center gap-3 border-b px-3 py-2 text-xs font-medium">
          <span className="min-w-0 flex-1">Product</span>
          <span className="hidden w-[110px] shrink-0 text-right sm:block">Current</span>
          <span className="hidden w-[110px] shrink-0 md:block">MRP</span>
          <span className="w-[120px] shrink-0">Selling price</span>
          <span className="hidden w-[120px] shrink-0 md:block">Bulk price</span>
          <span className="hidden w-[90px] shrink-0 text-right lg:block">Updated</span>
        </div>

        <ul>
          {rows.map((row) => {
            const value = draft[row.variantId]!;
            const before = original[row.variantId]!;
            const isChanged =
              value.price !== before.price ||
              value.bulkPrice !== before.bulkPrice ||
              value.compareAtPrice !== (before.compareAtPrice ?? '');
            const priceValid = MONEY_PATTERN.test(value.price);
            const mrpTooLow = mrpBelowPrice(value);
            const mrpInvalid =
              mrpTooLow || (value.compareAtPrice !== '' && !MONEY_PATTERN.test(value.compareAtPrice));

            const delta =
              priceValid && MONEY_PATTERN.test(before.price)
                ? toPaise(value.price) - toPaise(before.price)
                : 0;
            const percent =
              delta !== 0 && toPaise(before.price) > 0
                ? Math.round((delta / toPaise(before.price)) * 100)
                : 0;

            return (
              <li
                key={row.variantId}
                className={cn(
                  'flex items-center gap-3 border-b px-3 py-2 last:border-b-0',
                  isChanged && 'bg-[var(--info-bg)]',
                )}
              >
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/products/${row.productId}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {row.productName}
                  </Link>
                  <span className="text-muted-foreground block truncate text-xs">
                    {[row.variantLabel, row.sku].filter(Boolean).join(' · ') || row.unitLabel || ''}
                  </span>
                </span>

                <span className="tabular text-muted-foreground hidden w-[110px] shrink-0 text-right sm:block">
                  {MONEY_PATTERN.test(before.price) ? formatINR(before.price) : '—'}
                </span>

                <span className="hidden w-[110px] shrink-0 md:block">
                  <Input
                    value={value.compareAtPrice}
                    onChange={(e) => set(row.variantId, 'compareAtPrice', e.target.value)}
                    inputMode="decimal"
                    placeholder="—"
                    aria-label={`MRP for ${row.productName}`}
                    title={mrpTooLow ? 'MRP must be higher than the selling price' : undefined}
                    className={cn('tabular h-8', mrpInvalid && 'border-[var(--critical-fg)]')}
                  />
                </span>

                <span className="w-[120px] shrink-0">
                  <Input
                    value={value.price}
                    onChange={(e) => set(row.variantId, 'price', e.target.value)}
                    // Never type="number": Android keyboards drop the decimal
                    // separator, and this is a phone-first routine.
                    inputMode="decimal"
                    aria-label={`New price for ${row.productName}`}
                    className={cn(
                      'tabular h-8',
                      !priceValid && value.price !== '' && 'border-[var(--critical-fg)]',
                    )}
                  />
                </span>

                <span className="hidden w-[120px] shrink-0 md:block">
                  <Input
                    value={value.bulkPrice}
                    onChange={(e) => set(row.variantId, 'bulkPrice', e.target.value)}
                    inputMode="decimal"
                    placeholder="—"
                    aria-label={`Bulk price for ${row.productName}`}
                    className="tabular h-8"
                  />
                </span>

                <span className="hidden w-[90px] shrink-0 justify-end text-right text-xs lg:flex">
                  {delta !== 0 ? (
                    <span
                      className={cn(
                        'tabular flex items-center gap-0.5 font-medium',
                        delta > 0 ? 'text-[var(--success-fg)]' : 'text-[var(--critical-fg)]',
                      )}
                    >
                      {delta > 0 ? (
                        <TrendingUpIcon className="size-3" />
                      ) : (
                        <TrendingDownIcon className="size-3" />
                      )}
                      {percent > 0 ? '+' : ''}
                      {percent}%
                    </span>
                  ) : isToday(row.priceUpdatedAt) ? (
                    <span className="text-[var(--success-fg)]">Today</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {row.priceUpdatedAt
                        ? new Date(row.priceUpdatedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : 'Never'}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {changed.length > 0 && (
        <p className="text-muted-foreground px-1 text-xs">
          Only the {changed.length} changed row{changed.length === 1 ? '' : 's'} will be saved.
          Everything else is left exactly as it is.
        </p>
      )}
    </div>
  );
}
