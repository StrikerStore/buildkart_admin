'use client';

import { useMemo, useState } from 'react';
import { PencilIcon, AlertTriangleIcon } from 'lucide-react';
import {
  MONEY_PATTERN,
  formatINR,
  normalizeMoney,
  toPaise,
  fromPaise,
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

type BulkField =
  | 'price'
  | 'compareAtPrice'
  | 'bulkPrice'
  | 'costPerItem'
  | 'stockQty'
  | 'lowStockThreshold'
  | 'unitLabelEn'
  | 'unitLabelHi';

const BULK_ACTIONS: Array<{ field: BulkField; label: string; money: boolean }> = [
  { field: 'price', label: 'Set price', money: true },
  { field: 'compareAtPrice', label: 'Set MRP', money: true },
  { field: 'bulkPrice', label: 'Set bulk price', money: true },
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
  onChange,
}: {
  variants: VariantDraft[];
  axisNames: string[];
  onChange: (next: VariantDraft[]) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ field: BulkField; money: boolean } | null>(null);
  const [adjust, setAdjust] = useState(false);

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
              <Select
                onValueChange={(value) => {
                  if (value === 'activate') applyToSelected(() => ({ isActive: true }));
                  else if (value === 'deactivate') applyToSelected(() => ({ isActive: false }));
                  else if (value === 'copyFirst') {
                    const source = selected[0];
                    if (source) {
                      applyToSelected(() => ({
                        price: source.price,
                        compareAtPrice: source.compareAtPrice,
                        bulkPrice: source.bulkPrice,
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
                <th className="w-[110px] px-2 py-2">Bulk</th>
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

                    {(['price', 'compareAtPrice', 'bulkPrice'] as const).map((field) => (
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
