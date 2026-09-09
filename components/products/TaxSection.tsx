'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { TaxRateDto } from '@buildkart/contract';
import { formatINR, toPaise, fromPaise } from '@buildkart/contract';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Radix reads '' as no selection, so "no preset" needs a real value. */
const CUSTOM = 'custom';

export type TaxState = {
  taxRateId: string | null;
  taxPercent: string;
  taxInclusive: boolean;
  hsnCode: string;
};

/**
 * Tax on a product.
 *
 * Its own section rather than a corner of `PricingSection`, and rendered
 * unconditionally: `PricingSection` only appears for a product without option
 * axes, so putting the rate there would leave every product with variants
 * unable to set one at all.
 *
 * Per product rather than per variant on purpose — the GST rate follows HSN
 * classification, which is a property of the goods, not the pack size.
 */
export function TaxSection({
  value,
  rates,
  samplePrice,
  fieldErrors,
  onChange,
}: {
  value: TaxState;
  rates: TaxRateDto[];
  /** A representative variant price, used only for the worked example below. */
  samplePrice: string | null;
  fieldErrors: Record<string, string>;
  onChange: (changes: Partial<TaxState>) => void;
}) {
  /*
   * A product may sit on a rate that has since been retired. The dropdown has
   * to keep offering it, or opening the form and saving without touching tax
   * would silently move the product onto something else.
   */
  const options = useMemo(() => {
    const current = rates.find((rate) => rate.id === value.taxRateId);
    if (value.taxRateId && !current) {
      return [...rates, { id: value.taxRateId, name: 'Current rate (retired)' } as TaxRateDto];
    }
    return rates;
  }, [rates, value.taxRateId]);

  const percent = Number(value.taxPercent) || 0;

  // The worked example is the whole point of the inclusive/exclusive choice
  // being visible: the two readings of the same number differ by 18%, and
  // getting it wrong is not obvious anywhere else until an invoice is printed.
  const example = useMemo(() => {
    if (!samplePrice || percent <= 0) return null;
    const price = toPaise(samplePrice);
    const rateBp = Math.round(percent * 100);

    if (value.taxInclusive) {
      const tax = Math.round((price * rateBp) / (10_000 + rateBp));
      return { base: fromPaise(price - tax), tax: fromPaise(tax), total: fromPaise(price) };
    }
    const tax = Math.round((price * rateBp) / 10_000);
    return { base: fromPaise(price), tax: fromPaise(tax), total: fromPaise(price + tax) };
  }, [samplePrice, percent, value.taxInclusive]);

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">Tax</h2>
        <p className="text-muted-foreground text-xs">
          The GST rate for this product.{' '}
          <Link href="/settings/tax" className="underline">
            Manage rates
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxRate">Rate</Label>
          <Select
            value={value.taxRateId ?? CUSTOM}
            onValueChange={(next) => {
              if (next === CUSTOM) {
                onChange({ taxRateId: null });
                return;
              }
              const rate = options.find((option) => option.id === next);
              // Picking a preset sets the percent too, because the two must
              // agree — the server enforces the same thing on save.
              onChange({
                taxRateId: next,
                taxPercent: rate ? String(Number(rate.percent)) : value.taxPercent,
              });
            }}
          >
            <SelectTrigger id="taxRate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((rate) => (
                <SelectItem key={rate.id} value={rate.id}>
                  {rate.name}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>Enter a rate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxPercent">Rate %</Label>
          <div className="relative">
            <Input
              id="taxPercent"
              value={value.taxPercent}
              onChange={(e) => onChange({ taxPercent: e.target.value })}
              // Read-only while a preset is selected: the preset is the source
              // of truth, and an editable box beside it invites them to differ.
              disabled={value.taxRateId !== null}
              inputMode="decimal"
              className="tabular pr-7"
            />
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
              %
            </span>
          </div>
          {fieldErrors.taxPercent && (
            <span className="text-xs text-[var(--critical-fg)]">{fieldErrors.taxPercent}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hsnCode">HSN code</Label>
          <Input
            id="hsnCode"
            value={value.hsnCode}
            onChange={(e) => onChange({ hsnCode: e.target.value })}
            placeholder="2523"
            inputMode="numeric"
            className="font-mono"
          />
          {fieldErrors.hsnCode ? (
            <span className="text-xs text-[var(--critical-fg)]">{fieldErrors.hsnCode}</span>
          ) : (
            <span className="text-muted-foreground text-xs">Printed on the invoice.</span>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 font-medium">The price I entered</legend>

        <label className="flex items-start gap-2.5">
          <input
            type="radio"
            name="taxInclusive"
            checked={value.taxInclusive}
            onChange={() => onChange({ taxInclusive: true })}
            className="mt-1"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Includes tax</span>
            <span className="text-muted-foreground text-xs">
              What the customer pays. Nothing is added at checkout.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5">
          <input
            type="radio"
            name="taxInclusive"
            checked={!value.taxInclusive}
            onChange={() => onChange({ taxInclusive: false })}
            className="mt-1"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Excludes tax</span>
            <span className="text-muted-foreground text-xs">
              Tax is added on top at checkout.
            </span>
          </span>
        </label>
      </fieldset>

      {example && (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-xs">
          At {formatINR(samplePrice!)}: goods {formatINR(example.base)} + GST{' '}
          {formatINR(example.tax)} ={' '}
          <span className="font-medium">{formatINR(example.total)}</span> to the customer.
        </p>
      )}
    </section>
  );
}
