'use client';

import { useMemo, useState } from 'react';
import { PencilIcon, AlertTriangleIcon, PlusIcon, XIcon } from 'lucide-react';
import {
  MAX_PRICE_TIERS,
  MONEY_PATTERN,
  formatINR,
  normalizeMoney,
  toPaise,
  fromPaise,
  validateTierLadder,
  type BulkTierBasis,
  type PriceTierDraft,
  type VariantDraft,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';
import { PriceTierEditor } from './PriceTierEditor';

type BulkField =
  | 'price'
  | 'compareAtPrice'
  | 'costPerItem'
  | 'stockQty'
  | 'lowStockThreshold'
  | 'unitLabelEn'
  | 'unitLabelHi';

const BULK_ACTIONS: Array<{ field: BulkField; label: string; money: boolean }> = [
  { field: 'price', label: 'Set price', money: true },
  { field: 'compareAtPrice', label: 'Set MRP', money: true },
  { field: 'costPerItem', label: 'Set cost', money: true },
  { field: 'stockQty', label: 'Set stock', money: false },
  { field: 'lowStockThreshold', label: 'Set low-stock alert', money: false },
  { field: 'unitLabelEn', label: 'Set unit (English)', money: false },
  // Hindi has no column of its own — a second unit column would crowd the table
  // for a value that is almost always identical across a product's variants.
  { field: 'unitLabelHi', label: 'Set unit (Hindi)', money: false },
];

/**
 * Offered as suggestions rather than a fixed list, because construction sells
 * by units a dropdown would never anticipate.
 */
const UNIT_SUGGESTIONS = [
  'per bag',
  'per kg',
  'per quintal',
  'per tonne',
  'per piece',
  'per sheet',
  'per box',
  'per metre',
  'per sq ft',
  'per litre',
];

/**
 * The variant table.
 *
 * Every edit here is local state; nothing reaches the server until Save. That is
 * what makes bulk operations safe to explore — setting a price across forty rows
 * and then changing your mind costs nothing.
 */
export function VariantMatrixEditor({
  variants,
  axisNames,
  bulkTierBasis,
  onChange,
}: {
  variants: VariantDraft[];
  axisNames: string[];
  /** From the product — the ladders in this table all read the same way. */
  bulkTierBasis: BulkTierBasis;
  onChange: (next: VariantDraft[]) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ field: BulkField; money: boolean } | null>(null);
  const [adjust, setAdjust] = useState(false);
  const [bulkTiers, setBulkTiers] = useState(false);
  /** The row whose ladder is open, by matrix key. */
  const [tierRow, setTierRow] = useState<string | null>(null);

  const selected = useMemo(
    () => variants.filter((v) => checked.has(v.matrixKey)),
    [variants, checked],
  );

  function patch(matrixKey: string, changes: Partial<VariantDraft>) {
    onChange(variants.map((v) => (v.matrixKey === matrixKey ? { ...v, ...changes } : v)));
  }

  function applyToSelected(changes: (draft: VariantDraft) => Partial<VariantDraft>) {
    onChange(variants.map((v) => (checked.has(v.matrixKey) ? { ...v, ...changes(v) } : v)));
  }

  const allChecked = variants.length > 0 && checked.size === variants.length;
  const missingPrice = variants.filter((v) => !MONEY_PATTERN.test(v.price)).length;
  const missingUnit = variants.filter((v) => v.unitLabelEn.trim() === '').length;

  return (
    <div className="flex flex-col gap-3">
      {missingPrice > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--warning-fg)]">
          <AlertTriangleIcon className="size-3.5" />
          {missingPrice} variant{missingPrice === 1 ? '' : 's'} still need a price.
        </p>
      )}

      {missingPrice === 0 && missingUnit > 0 && (
        // "₹410" alone is ambiguous for materials sold by bag, kg or sheet —
        // and the unit is usually the same across a product, so selecting all
        // and setting it once is the intended fix.
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <AlertTriangleIcon className="size-3.5" />
          {missingUnit} variant{missingUnit === 1 ? ' has' : 's have'} no unit label, so
          {missingUnit === 1 ? ' its' : ' their'} price shows without one.
        </p>
      )}

      <div className="overflow-hidden rounded-md border">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          {selected.length > 0 ? (
            <>
              <span className="font-medium">{selected.length} selected</span>
              <div className="flex-1" />
              {BULK_ACTIONS.slice(0, 3).map((action) => (
                <Button
                  key={action.field}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBulk({ field: action.field, money: action.money })}
                >
                  {action.label}
                </Button>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setAdjust(true)}>
                Adjust prices
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setBulkTiers(true)}>
                Set bulk breaks
              </Button>
              <Select
                onValueChange={(value) => {
                  if (value === 'activate') applyToSelected(() => ({ isActive: true }));
                  else if (value === 'deactivate') applyToSelected(() => ({ isActive: false }));
                  else if (value === 'clearTiers') applyToSelected(() => ({ tiers: [] }));
                  else if (value === 'copyFirst') {
                    const source = selected[0];
                    if (source) {
                      applyToSelected(() => ({
                        price: source.price,
                        compareAtPrice: source.compareAtPrice,
                        // Copied, not shared: one array across rows would make
                        // editing a rung on one size edit it on all of them.
                        tiers: source.tiers.map((tier) => ({ ...tier, id: undefined })),
                        costPerItem: source.costPerItem,
                        unitLabelEn: source.unitLabelEn,
                        unitLabelHi: source.unitLabelHi,
                        lowStockThreshold: source.lowStockThreshold,
                      }));
                    }
                  } else {
                    const action = BULK_ACTIONS.find((a) => a.field === value);
                    if (action) setBulk({ field: action.field, money: action.money });
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue placeholder="More" />
                </SelectTrigger>
                <SelectContent>
                  {BULK_ACTIONS.slice(3).map((action) => (
                    <SelectItem key={action.field} value={action.field}>
                      {action.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="copyFirst">Copy from first selected</SelectItem>
                  <SelectItem value="activate">Activate</SelectItem>
                  <SelectItem value="deactivate">Deactivate</SelectItem>
                  <SelectItem value="clearTiers">Clear bulk breaks</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="sm" onClick={() => setChecked(new Set())}>
                Clear
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">
              {variants.length} variant{variants.length === 1 ? '' : 's'}. Select rows to edit
              several at once.
            </p>
          )}
        </div>

        {/* Shared by every unit input in the table. */}
        <datalist id="unit-suggestions">
          {UNIT_SUGGESTIONS.map((unit) => (
            <option key={unit} value={unit} />
          ))}
        </datalist>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="text-muted-foreground bg-muted/40 border-b text-left text-xs font-medium">
                <th className="w-8 px-3 py-2">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(v) =>
                      setChecked(v ? new Set(variants.map((x) => x.matrixKey)) : new Set())
                    }
                    aria-label="Select all variants"
                  />
                </th>
                <th className="min-w-[150px] px-2 py-2">{axisNames.join(' / ') || 'Variant'}</th>
                <th className="w-[130px] px-2 py-2">SKU</th>
                <th className="w-[110px] px-2 py-2">Price</th>
                <th className="w-[110px] px-2 py-2">MRP</th>
                <th className="w-[170px] px-2 py-2">Bulk breaks</th>
                <th className="w-[120px] px-2 py-2">Unit</th>
                <th className="w-[90px] px-2 py-2">Stock</th>
                <th className="w-[70px] px-2 py-2 text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => {
                const isChecked = checked.has(variant.matrixKey);
                const priceInvalid = variant.price !== '' && !MONEY_PATTERN.test(variant.price);

                return (
                  <tr
                    key={variant.matrixKey}
                    className={cn(
                      'border-b last:border-b-0',
                      isChecked && 'bg-[var(--info-bg)]',
                      !variant.isActive && 'opacity-55',
                    )}
                  >
                    <td className="px-3 py-1.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) =>
                          setChecked((current) => {
                            const next = new Set(current);
                            if (v) next.add(variant.matrixKey);
                            else next.delete(variant.matrixKey);
                            return next;
                          })
                        }
                        aria-label={`Select ${variant.optionValues.join(' / ')}`}
                      />
                    </td>

                    <td className="px-2 py-1.5 font-medium">
                      {variant.optionValues.join(' / ') || 'Default'}
                    </td>

                    <td className="px-2 py-1.5">
                      <Input
                        value={variant.sku}
                        onChange={(e) => patch(variant.matrixKey, { sku: e.target.value })}
                        className="h-8 font-mono text-xs"
                        maxLength={64}
                      />
                    </td>

                    {(['price', 'compareAtPrice'] as const).map((field) => (
                      <td key={field} className="px-2 py-1.5">
                        <Input
                          value={variant[field]}
                          onChange={(e) => patch(variant.matrixKey, { [field]: e.target.value })}
                          // Never type="number": Android keyboards drop the
                          // decimal separator, and this catalog is entered on a
                          // budget Android phone.
                          inputMode="decimal"
                          placeholder="0.00"
                          className={cn(
                            'tabular h-8',
                            field === 'price' && priceInvalid && 'border-[var(--critical-fg)]',
                          )}
                        />
                      </td>
                    ))}

                    {/*
                      * A ladder is a list, and there is no column shape for one.
                      * The cell summarises it and opens the editor.
                      *
                      * Shown at every width. It used to be desktop-only, which
                      * left an owner pricing from a phone — the device this
                      * catalogue is mostly entered on — with no way to set a
                      * bulk rate on any variant. The table already scrolls
                      * sideways, so one more column costs nothing.
                      */}
                    <td className="px-2 py-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          'tabular h-8 w-full justify-start truncate font-normal',
                          validateTierLadder(bulkTierBasis, variant.price, variant.tiers).length >
                            0 && 'border-[var(--critical-fg)] text-[var(--critical-fg)]',
                        )}
                        onClick={() => setTierRow(variant.matrixKey)}
                        aria-label={`Bulk price breaks for ${variant.optionValues.join(' / ') || 'this variant'}`}
                      >
                        {tierSummary(bulkTierBasis, variant.tiers)}
                      </Button>
                    </td>

                    <td className="px-2 py-1.5">
                      <Input
                        value={variant.unitLabelEn}
                        onChange={(e) =>
                          patch(variant.matrixKey, { unitLabelEn: e.target.value })
                        }
                        list="unit-suggestions"
                        placeholder="per kg"
                        className="h-8"
                        maxLength={32}
                      />
                    </td>

                    <td className="px-2 py-1.5">
                      <Input
                        value={variant.stockQty}
                        onChange={(e) =>
                          patch(variant.matrixKey, { stockQty: e.target.value.replace(/\D/g, '') })
                        }
                        inputMode="numeric"
                        className="tabular h-8"
                      />
                    </td>

                    <td className="px-2 py-1.5 text-center">
                      <Checkbox
                        checked={variant.isActive}
                        onCheckedChange={(v) => patch(variant.matrixKey, { isActive: Boolean(v) })}
                        aria-label={`${variant.optionValues.join(' / ')} active`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <BulkSetDialog
        open={bulk !== null}
        field={bulk?.field ?? 'price'}
        isMoney={bulk?.money ?? false}
        count={selected.length}
        onClose={() => setBulk(null)}
        onApply={(value) => {
          const field = bulk!.field;
          applyToSelected(() => ({ [field]: value }) as Partial<VariantDraft>);
          setBulk(null);
        }}
      />

      {/*
        * The row's ladder editor. It was defined below and never mounted, so
        * the cell above set `tierRow` and nothing opened — which is why no
        * variant of a multi-size product could be given a bulk price.
        */}
      <TierDialog
        open={tierRow !== null}
        onOpenChange={(open) => !open && setTierRow(null)}
        basis={bulkTierBasis}
        variant={variants.find((v) => v.matrixKey === tierRow) ?? null}
        axisNames={axisNames}
        onChange={(tiers) => tierRow && patch(tierRow, { tiers })}
      />

      <BulkTiersDialog
        open={bulkTiers}
        basis={bulkTierBasis}
        selected={selected}
        onClose={() => setBulkTiers(false)}
        onApply={(ladderFor) => {
          applyToSelected((draft) => {
            const tiers = ladderFor(draft);
            return tiers ? { tiers } : {};
          });
          setBulkTiers(false);
        }}
      />

      <AdjustPricesDialog
        open={adjust}
        selected={selected}
        onClose={() => setAdjust(false)}
        onApply={(compute) => {
          applyToSelected((draft) => ({ price: compute(draft.price) }));
          setAdjust(false);
        }}
      />
    </div>
  );
}

function BulkSetDialog({
  open,
  field,
  isMoney,
  count,
  onClose,
  onApply,
}: {
  open: boolean;
  field: BulkField;
  isMoney: boolean;
  count: number;
  onClose: () => void;
  onApply: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const label = BULK_ACTIONS.find((a) => a.field === field)?.label ?? 'Set value';
  const valid = !isMoney || value === '' || MONEY_PATTERN.test(value);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValue('');
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Applies to {count} selected variant{count === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bulk-value">{isMoney ? 'Amount' : 'Value'}</Label>
          <Input
            id="bulk-value"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={isMoney ? 'decimal' : undefined}
            className={cn(isMoney && 'tabular')}
          />
          {!valid && (
            <p className="text-[var(--critical-fg)] text-xs">Enter an amount like 410 or 410.50</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!valid}
            onClick={() => {
              onApply(isMoney && value !== '' ? normalizeMoney(value) : value);
              setValue('');
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Percentage or fixed adjustment, with the resulting prices previewed before
 * anything is applied — a blind "raise everything 8%" across forty rows is not
 * something anyone should have to run on faith.
 */
function AdjustPricesDialog({
  open,
  selected,
  onClose,
  onApply,
}: {
  open: boolean;
  selected: VariantDraft[];
  onClose: () => void;
  onApply: (compute: (price: string) => string) => void;
}) {
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [amount, setAmount] = useState('');

  const numeric = Number(amount);
  const valid = amount !== '' && Number.isFinite(numeric) && numeric > 0;

  function compute(price: string): string {
    if (!MONEY_PATTERN.test(price) || !valid) return price;
    const paise = toPaise(price);
    const delta =
      mode === 'percent' ? Math.round((paise * numeric) / 100) : toPaise(normalizeMoney(amount));
    const next = direction === 'increase' ? paise + delta : Math.max(0, paise - delta);
    return fromPaise(next);
  }

  const preview = selected.slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Adjust prices</DialogTitle>
          <DialogDescription>
            Changes the price of {selected.length} selected variant
            {selected.length === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="increase">Increase</SelectItem>
              <SelectItem value="decrease">Decrease</SelectItem>
            </SelectContent>
          </Select>

          <Input
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="10"
            className="tabular flex-1"
          />

          <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">%</SelectItem>
              <SelectItem value="amount">₹</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {valid && preview.length > 0 && (
          <div className="bg-muted/40 flex flex-col gap-1 rounded-md border p-2 text-xs">
            {preview.map((variant) => (
              <div key={variant.matrixKey} className="flex items-center justify-between gap-2">
                <span className="truncate">{variant.optionValues.join(' / ') || 'Default'}</span>
                <span className="tabular shrink-0">
                  {MONEY_PATTERN.test(variant.price) ? formatINR(variant.price) : '—'}
                  <PencilIcon className="mx-1 inline size-3" />
                  <span className="font-medium">
                    {MONEY_PATTERN.test(variant.price) ? formatINR(compute(variant.price)) : '—'}
                  </span>
                </span>
              </div>
            ))}
            {selected.length > preview.length && (
              <p className="text-muted-foreground">
                and {selected.length - preview.length} more…
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!valid}
            onClick={() => {
              onApply(compute);
              setAmount('');
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One row's bulk ladder, in a dialog.
 *
 * The matrix is a grid of scalar cells and a ladder is a list, so it cannot be
 * a column. A dialog keeps the table readable and still puts the rungs one tap
 * away from the row they belong to.
 */
function TierDialog({
  open,
  onOpenChange,
  basis,
  variant,
  axisNames,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basis: BulkTierBasis;
  variant: VariantDraft | null;
  axisNames: string[];
  onChange: (tiers: VariantDraft['tiers']) => void;
}) {
  if (!variant) return null;

  const label = variant.optionValues.join(' / ') || axisNames.join(' / ') || 'this variant';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Bulk price breaks — {label}</DialogTitle>
        </DialogHeader>

        <PriceTierEditor
          basis={basis}
          listPrice={variant.price}
          tiers={variant.tiers}
          unitLabel={variant.unitLabelEn}
          onTiersChange={onChange}
        />

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A row's ladder in the space of a cell: "10+ ₹1,250", then "+2 more".
 *
 * The rate, not only the threshold. "10+ · 20+" said where the breaks were and
 * nothing about what they charged, so checking a matrix meant opening every
 * row.
 */
function tierSummary(basis: BulkTierBasis, tiers: PriceTierDraft[]): string {
  if (tiers.length === 0) return '+ Add';
  const first = tiers[0]!;
  const threshold =
    basis === 'QUANTITY'
      ? `${first.threshold || '?'}+`
      : MONEY_PATTERN.test(first.threshold)
        ? `${formatINR(first.threshold)}+`
        : '₹?+';
  const rate = MONEY_PATTERN.test(first.unitPrice) ? formatINR(first.unitPrice) : '₹?';
  return `${threshold} ${rate}${tiers.length > 1 ? ` · +${tiers.length - 1} more` : ''}`;
}

type LadderRow = { threshold: string; value: string };

const EMPTY_ROW: LadderRow = { threshold: '', value: '' };

function validPercent(value: string): boolean {
  const percent = Number(value);
  return value.trim() !== '' && Number.isFinite(percent) && percent > 0 && percent < 100;
}

/**
 * One ladder, applied to every selected row at once.
 *
 * **By percentage, or by a fixed rate.** A product sold in 1, 2, 5 and 10 cubic
 * metre loads cannot share a rupee rate — ₹1,250 is a discount on the smallest
 * and a giveaway on the largest — but "5% off from 10 up" means the same thing
 * on every size. Percent is the default for that reason; the fixed rate is for
 * sizes that genuinely sell at one price.
 *
 * The result is written as ordinary per-row rungs, so each row can still be
 * fine-tuned afterwards in its own dialog. Rows without a valid price are left
 * alone rather than given a ladder computed from nothing.
 */
function BulkTiersDialog({
  open,
  basis,
  selected,
  onClose,
  onApply,
}: {
  open: boolean;
  basis: BulkTierBasis;
  selected: VariantDraft[];
  onClose: () => void;
  /** Receives a function giving each row its ladder, or null to leave it. */
  onApply: (ladderFor: (draft: VariantDraft) => PriceTierDraft[] | null) => void;
}) {
  const [mode, setMode] = useState<'percent' | 'rate'>('percent');
  const [rows, setRows] = useState<LadderRow[]>([EMPTY_ROW]);
  const quantity = basis === 'QUANTITY';

  function close() {
    setRows([EMPTY_ROW]);
    setMode('percent');
    onClose();
  }

  function update(index: number, changes: Partial<LadderRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  const filled = rows.filter((row) => row.threshold.trim() !== '' || row.value.trim() !== '');

  /** The ladder this dialog would give one row, or null if the row has no price. */
  function ladderFor(draft: VariantDraft): PriceTierDraft[] | null {
    if (!MONEY_PATTERN.test(draft.price)) return null;
    const listPaise = toPaise(draft.price);

    return filled.map((row) => {
      const threshold =
        !quantity && MONEY_PATTERN.test(row.threshold)
          ? normalizeMoney(row.threshold)
          : row.threshold.trim();

      if (mode === 'rate') {
        return {
          threshold,
          unitPrice: MONEY_PATTERN.test(row.value) ? normalizeMoney(row.value) : row.value.trim(),
        };
      }

      return {
        threshold,
        // Rounded to the rupee: a bulk rate of ₹1,234.35 reads as arithmetic,
        // not as a price anyone quoted.
        unitPrice: validPercent(row.value)
          ? fromPaise(Math.round((listPaise * (100 - Number(row.value))) / 10_000) * 100)
          : row.value,
      };
    });
  }

  const priced = selected.filter((draft) => MONEY_PATTERN.test(draft.price));
  const unpriced = selected.length - priced.length;

  /*
   * Checked with the same validator as the per-row editor and the server, on
   * every row it would land on — a ladder that is fine for the ₹9,000 size can
   * still clash with the ₹1,300 one.
   */
  const problems =
    mode === 'percent' && filled.some((row) => !validPercent(row.value))
      ? ['Enter a percentage between 0 and 100, like 5.']
      : Array.from(
          new Set(
            priced.flatMap((draft) =>
              validateTierLadder(basis, draft.price, ladderFor(draft) ?? []).map((problem) =>
                priced.length > 1
                  ? `${draft.optionValues.join(' / ') || 'Default'}: ${problem}`
                  : problem,
              ),
            ),
          ),
        ).slice(0, 6);

  const canApply = filled.length > 0 && problems.length === 0 && priced.length > 0;
  const preview = priced.slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Set bulk price breaks</DialogTitle>
          <DialogDescription>
            Replaces the bulk breaks on {selected.length} selected variant
            {selected.length === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bulk-tier-mode">Bulk price as</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <SelectTrigger id="bulk-tier-mode" className="sm:w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">% off each variant&apos;s price</SelectItem>
              <SelectItem value="rate">The same ₹ rate for every variant</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="text-muted-foreground w-10 shrink-0 text-xs">
                {quantity ? 'From' : 'Over ₹'}
              </span>
              <Input
                value={row.threshold}
                onChange={(e) => update(index, { threshold: e.target.value })}
                inputMode={quantity ? 'numeric' : 'decimal'}
                placeholder={quantity ? '10' : '10000'}
                aria-label={`Break ${index + 1} ${quantity ? 'quantity' : 'order value'}`}
                className="tabular h-9 w-20"
              />
              <span className="text-muted-foreground shrink-0 text-xs">
                {quantity ? '+ ' : ''}
                {mode === 'percent' ? 'get' : 'at ₹'}
              </span>
              <Input
                value={row.value}
                onChange={(e) => update(index, { value: e.target.value })}
                inputMode="decimal"
                placeholder={mode === 'percent' ? '5' : '370'}
                aria-label={`Break ${index + 1} ${mode === 'percent' ? 'percent off' : 'rate'}`}
                className="tabular h-9 w-20"
              />
              {mode === 'percent' && (
                <span className="text-muted-foreground shrink-0 text-xs">% off</span>
              )}
              <div className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                aria-label={`Remove price break ${index + 1}`}
                disabled={rows.length === 1}
              >
                <XIcon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>

        {rows.length < MAX_PRICE_TIERS && (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((current) => [...current, EMPTY_ROW])}
            >
              <PlusIcon className="size-4" />
              Add another break
            </Button>
          </div>
        )}

        {canApply && preview.length > 0 && (
          <div className="bg-muted/40 flex flex-col gap-1 rounded-md border p-2 text-xs">
            {preview.map((draft) => (
              <div key={draft.matrixKey} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {draft.optionValues.join(' / ') || 'Default'} · {formatINR(draft.price)}
                </span>
                <span className="tabular shrink-0 font-medium">
                  {(ladderFor(draft) ?? [])
                    .map(
                      (tier) =>
                        `${quantity ? `${tier.threshold}+` : `${formatINR(tier.threshold)}+`} ${formatINR(tier.unitPrice)}`,
                    )
                    .join(' · ')}
                </span>
              </div>
            ))}
            {priced.length > preview.length && (
              <p className="text-muted-foreground">and {priced.length - preview.length} more…</p>
            )}
          </div>
        )}

        {unpriced > 0 && (
          <p className="text-muted-foreground text-xs">
            {unpriced} selected variant{unpriced === 1 ? ' has' : 's have'} no price yet and will
            be skipped.
          </p>
        )}

        {filled.length > 0 && problems.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs text-[var(--critical-fg)]">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canApply}
            onClick={() => {
              onApply(ladderFor);
              close();
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
