'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircleIcon, CheckIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  MONEY_PATTERN,
  formatINR,
  normalizeMoney,
  toPaise,
  fromPaise,
  validateTierLadder,
  type BulkTierBasis,
  type PriceTierDraft,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PriceTierEditor } from '@/components/products/PriceTierEditor';
import { cn } from '@/lib/utils';
import { saveRates } from '@/app/(dashboard)/rates/actions';

type Ladder = Array<{ threshold: string; unitPrice: string }>;

export type RateRow = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  unitLabel: string | null;
  price: string;
  /** The MRP, struck through on the storefront. Empty when there is none. */
  compareAtPrice: string;
  /** ISO date of the last price change, or null if never. */
  priceUpdatedAt: string | null;
  /*
   * Optional because the admin and the API deploy separately: an admin built
   * against this shape can meet an API that does not send them yet, and must
   * then behave exactly as it did before bulk rates came to this screen.
   */
  basis?: BulkTierBasis;
  tiers?: Ladder;
};

type Draft = {
  price: string;
  compareAtPrice: string;
  /**
   * The ladder the owner edited by hand, or null while it still follows the
   * price. Null is the common case — see `effectiveTiers`.
   */
  tiers: PriceTierDraft[] | null;
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
 * The ladder a row will save.
 *
 * Edited by hand → exactly what was typed. Otherwise, with "follow price" on,
 * the stored ladder moved by the same rupees as the price, so the per-unit
 * saving holds: cement ₹400 → ₹410 takes the 50-bag rate from ₹395 to ₹405.
 * That is how the trade quotes a bulk rate — "₹5 off a bag at fifty" — and a
 * ladder left where it was would, on a price cut, end up at or above the new
 * price and silently stop applying.
 *
 * Moved in rupees rather than scaled by percent because a percentage of a
 * bulk discount is not a number anybody negotiates in. Thresholds never move:
 * "50 bags" is still fifty bags whatever cement costs.
 */
function effectiveTiers(row: RateRow, draft: Draft, follow: boolean): Ladder {
  if (draft.tiers) return draft.tiers;
  const stored = row.tiers ?? [];
  if (!follow || stored.length === 0) return stored;
  if (!MONEY_PATTERN.test(draft.price) || !MONEY_PATTERN.test(row.price)) return stored;

  const delta = toPaise(draft.price) - toPaise(row.price);
  if (delta === 0) return stored;
  return stored.map((tier) => ({
    threshold: tier.threshold,
    unitPrice: MONEY_PATTERN.test(tier.unitPrice)
      ? fromPaise(Math.max(0, toPaise(tier.unitPrice) + delta))
      : tier.unitPrice,
  }));
}

/** Blank rungs dropped and money normalised — the form the server compares. */
function cleanLadder(tiers: Ladder, basis: BulkTierBasis): Ladder {
  return tiers
    .filter((tier) => tier.threshold.trim() !== '' || tier.unitPrice.trim() !== '')
    .map((tier) => ({
      threshold:
        basis === 'AMOUNT' && MONEY_PATTERN.test(tier.threshold.trim())
          ? normalizeMoney(tier.threshold.trim())
          : tier.threshold.trim(),
      unitPrice: MONEY_PATTERN.test(tier.unitPrice.trim())
        ? normalizeMoney(tier.unitPrice.trim())
        : tier.unitPrice.trim(),
    }));
}

function sameLadder(a: Ladder, b: Ladder): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** "50+ ₹395 · +1" — a ladder in the width of a button. */
function ladderSummary(basis: BulkTierBasis, tiers: Ladder): string {
  if (tiers.length === 0) return '+ Bulk rate';
  const first = tiers[0]!;
  const threshold =
    basis === 'AMOUNT'
      ? MONEY_PATTERN.test(first.threshold)
        ? `${formatINR(first.threshold)}+`
        : '₹?+'
      : `${first.threshold || '?'}+`;
  const rate = MONEY_PATTERN.test(first.unitPrice) ? formatINR(first.unitPrice) : '₹?';
  return `${threshold} ${rate}${tiers.length > 1 ? ` · +${tiers.length - 1}` : ''}`;
}

/**
 * The morning routine.
 *
 * Built around one measurement: how long it takes to change six cement prices
 * and be sure they saved. So every row is one tab stop, only edited rows are
 * sent, and the rows already done today are marked — the owner should be able
 * to see at a glance what is left rather than re-reading prices they already
 * updated.
 *
 * **Bulk rates travel with the price.** They are saved in the same request and
 * the same transaction, so a morning update can never land the new cement rate
 * and lose its fifty-bag rate, or the other way round.
 */
export function RatesTable({ rows }: { rows: RateRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.variantId,
        {
          price: r.price,
          /*
           * `?? ''` because the API may not send this yet. Admin and the API
           * deploy separately, and an undefined here would hand React an
           * uncontrolled input that silently stops tracking what is typed.
           */
          compareAtPrice: r.compareAtPrice ?? '',
          tiers: null,
        },
      ]),
    ),
  );
  const [isSaving, startSaving] = useTransition();
  const [follow, setFollow] = useState(true);
  /** The row whose bulk ladder is open, by variant id. */
  const [ladderRow, setLadderRow] = useState<string | null>(null);

  // Bulk adjustment, for the days when everything moves together.
  const [adjustDirection, setAdjustDirection] = useState<'increase' | 'decrease'>('increase');
  const [adjustMode, setAdjustMode] = useState<'percent' | 'amount'>('percent');
  const [adjustAmount, setAdjustAmount] = useState('');

  const original = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.variantId, r])),
    [rows],
  );

  /** Every row's state, derived once per render: what it would save and why. */
  const computed = useMemo(
    () =>
      rows.map((row) => {
        const value = draft[row.variantId]!;
        const basis = row.basis ?? 'QUANTITY';
        const tiers = cleanLadder(effectiveTiers(row, value, follow), basis);
        const priceChanged =
          value.price !== row.price || value.compareAtPrice !== (row.compareAtPrice ?? '');
        const ladderChanged = !sameLadder(tiers, cleanLadder(row.tiers ?? [], basis));
        const ladderProblems = MONEY_PATTERN.test(value.price)
          ? validateTierLadder(basis, normalizeMoney(value.price), tiers)
          : [];
        return { row, value, basis, tiers, priceChanged, ladderChanged, ladderProblems };
      }),
    [rows, draft, follow],
  );

  const changed = computed.filter((c) => c.priceChanged || c.ladderChanged);

  const invalid = changed.filter(({ value, ladderProblems }) => {
    if (!MONEY_PATTERN.test(value.price)) return true;
    if (value.compareAtPrice !== '' && !MONEY_PATTERN.test(value.compareAtPrice)) return true;
    // Caught here as well as on the server, because the server rejects the
    // whole save and the owner would lose a screen of typing to one bad row.
    if (mrpBelowPrice(value)) return true;
    if (ladderProblems.length > 0) return true;
    return false;
  });

  function set(variantId: string, field: 'price' | 'compareAtPrice', value: string) {
    setDraft((current) => ({
      ...current,
      [variantId]: { ...current[variantId]!, [field]: value },
    }));
  }

  function setTiers(variantId: string, tiers: PriceTierDraft[]) {
    setDraft((current) => ({
      ...current,
      [variantId]: { ...current[variantId]!, tiers },
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
      toast.error(
        `${invalid.length} row${invalid.length === 1 ? ' needs' : 's need'} fixing before saving.`,
      );
      return;
    }

    startSaving(async () => {
      const result = await saveRates({
        changes: changed.map(({ row, value, tiers, ladderChanged }) => ({
          variantId: row.variantId,
          price: normalizeMoney(value.price),
          compareAtPrice: value.compareAtPrice,
          // Only when it moved: an absent ladder tells the server to leave
          // the stored one alone.
          ...(ladderChanged ? { tiers } : {}),
        })),
      });

      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not save the rates.', {
          description: result.formErrors.slice(1, 4).join(' ') || undefined,
        });
        return;
      }
      toast.success(`${result.data.updated} rate${result.data.updated === 1 ? '' : 's'} updated`);
      // Hand-edited ladders are now the stored ones; let them follow again.
      setDraft((current) =>
        Object.fromEntries(
          Object.entries(current).map(([id, value]) => [id, { ...value, tiers: null }]),
        ),
      );
      router.refresh();
    });
  }

  if (rows.length === 0) return null;

  const doneToday = rows.filter((r) => isToday(r.priceUpdatedAt)).length;
  const withLadders = rows.filter((r) => (r.tiers ?? []).length > 0).length;
  const open = computed.find((c) => c.row.variantId === ladderRow) ?? null;

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

        {/*
          * Its own line, under the adjust controls it modifies. Only shown
          * once any row has a ladder — on a shop with none, a switch about
          * bulk rates is a question about nothing.
          */}
        {withLadders > 0 && (
          <div className="flex w-full items-center gap-2 border-t pt-2">
            <Switch id="follow-price" checked={follow} onCheckedChange={setFollow} />
            <Label htmlFor="follow-price" className="text-xs font-normal">
              Bulk rates follow price — keep the same ₹ saving per unit when a price changes
            </Label>
          </div>
        )}
      </div>

      <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
        <div className="text-muted-foreground bg-muted/40 flex items-center gap-3 border-b px-3 py-2 text-xs font-medium">
          <span className="min-w-0 flex-1">Product</span>
          <span className="hidden w-[110px] shrink-0 text-right sm:block">Current</span>
          <span className="hidden w-[110px] shrink-0 md:block">MRP</span>
          <span className="w-[120px] shrink-0">Selling price</span>
          <span className="hidden w-[140px] shrink-0 sm:block">Bulk rates</span>
          <span className="hidden w-[90px] shrink-0 text-right lg:block">Updated</span>
        </div>

        <ul>
          {computed.map(({ row, value, basis, tiers, priceChanged, ladderChanged, ladderProblems }) => {
            const before = original[row.variantId]!;
            const isChanged = priceChanged || ladderChanged;
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

            const ladderButton = (className: string) => (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLadderRow(row.variantId)}
                aria-label={`Bulk rates for ${row.productName}`}
                title={ladderProblems[0]}
                className={cn(
                  'tabular justify-start truncate font-normal',
                  tiers.length === 0 && 'text-muted-foreground',
                  ladderChanged && 'border-[var(--info-fg)]',
                  ladderProblems.length > 0 &&
                    'border-[var(--critical-fg)] text-[var(--critical-fg)]',
                  className,
                )}
              >
                {ladderSummary(basis, tiers)}
              </Button>
            );

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
                  {/* On a phone the row has no room for a column, so the
                      ladder sits under the name instead of disappearing. */}
                  {ladderButton('mt-1 h-7 max-w-full px-2 text-xs sm:hidden')}
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

                <span className="hidden w-[140px] shrink-0 sm:block">
                  {ladderButton('h-8 w-full')}
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

      <Dialog open={open !== null} onOpenChange={(next) => !next && setLadderRow(null)}>
        {open && (
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>
                Bulk rates — {open.row.productName}
                {open.row.variantLabel ? ` · ${open.row.variantLabel}` : ''}
              </DialogTitle>
              <DialogDescription>
                Against the new price of{' '}
                {MONEY_PATTERN.test(open.value.price) ? formatINR(open.value.price) : '—'}. Saved
                with the rest of today&apos;s rates.
              </DialogDescription>
            </DialogHeader>

            <PriceTierEditor
              basis={open.basis}
              listPrice={open.value.price}
              // Seeded with what the row would save right now — including a
              // follow-price shift — so editing starts from the numbers shown.
              tiers={open.value.tiers ?? open.tiers}
              unitLabel={open.row.unitLabel ?? undefined}
              onTiersChange={(tiers) => setTiers(open.row.variantId, tiers)}
            />

            <DialogFooter className="gap-2 sm:justify-between">
              {open.value.tiers !== null ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      [open.row.variantId]: { ...current[open.row.variantId]!, tiers: null },
                    }))
                  }
                >
                  Undo my edits
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" onClick={() => setLadderRow(null)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
