'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  addMoney,
  compareMoney,
  distanceAdditionFor,
  formatINR,
  isMoneyString,
  type PricingKind,
} from '@StrikerStore/contract';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type DeliveryPricingState = {
  pricingKind: PricingKind;
  distanceBaseAddition: string;
  distanceBlockKm: string;
  distancePerBlockAddition: string;
};

/** The distances the preview prices at. */
const PREVIEW_KM = [0, 2.5, 5, 7.5, 10, 15, 25];

const KINDS: Array<{ value: PricingKind; title: string; detail: string }> = [
  {
    value: 'FLAT',
    title: 'Same price everywhere',
    detail: 'Delivery is charged on the order, from Delivery → Delivery charges.',
  },
  {
    value: 'DISTANCE',
    title: 'Price rises with distance',
    detail: 'The price includes carrying it to the customer. Delivery is free.',
  },
];

/**
 * How this product's price behaves with distance.
 *
 * Its own section, rendered unconditionally like tax: the figures belong to
 * the product, and every variant in the matrix shares them. The addition is per
 * unit and sits on top of the list price and every bulk rung.
 */
export function DeliveryPricingSection({
  value,
  samplePrice,
  sampleCompareAt,
  unitLabel,
  fieldErrors,
  onChange,
}: {
  value: DeliveryPricingState;
  /** A representative variant's price and MRP, for the worked table. */
  samplePrice: string | null;
  sampleCompareAt: string | null;
  unitLabel: string | null;
  fieldErrors: Record<string, string>;
  onChange: (changes: Partial<DeliveryPricingState>) => void;
}) {
  const distance = value.pricingKind === 'DISTANCE';

  /*
   * The price at each distance, worked with the same `distanceAdditionFor` the
   * cart and the order writer call — so what the owner reads here is what a
   * customer that far away will be charged.
   */
  const rows = useMemo(() => {
    const base = value.distanceBaseAddition.trim() || '0';
    const perBlock = value.distancePerBlockAddition.trim() || '0';
    const blockKm = Number(value.distanceBlockKm);
    if (!isMoneyString(base) || !isMoneyString(perBlock) || !(blockKm >= 0.5)) return null;
    const params = { baseAddition: base, blockKm, perBlockAddition: perBlock };
    return PREVIEW_KM.map((km) => {
      const addition = distanceAdditionFor(Math.round(km * 1000), params);
      const price =
        samplePrice && isMoneyString(samplePrice.trim()) ? addMoney(samplePrice.trim(), addition) : null;
      return { km, addition, price };
    });
  }, [value.distanceBaseAddition, value.distanceBlockKm, value.distancePerBlockAddition, samplePrice]);

  const mrp = sampleCompareAt && isMoneyString(sampleCompareAt.trim()) ? sampleCompareAt.trim() : null;
  const overMrp = mrp && rows ? rows.find((row) => row.price && compareMoney(row.price, mrp) > 0) : null;

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">Delivery and distance</h2>
        <p className="text-muted-foreground text-xs">
          How this product is charged for getting it to the customer.{' '}
          <Link href="/delivery/charges" className="underline">
            Delivery charges
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Pricing kind">
        {KINDS.map((kind) => (
          <button
            key={kind.value}
            type="button"
            role="radio"
            aria-checked={value.pricingKind === kind.value}
            onClick={() => onChange({ pricingKind: kind.value })}
            className={cn(
              'flex flex-col gap-0.5 rounded-md border p-3 text-left transition-colors',
              value.pricingKind === kind.value
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/60',
            )}
          >
            <span className="text-sm font-medium">{kind.title}</span>
            <span className="text-muted-foreground text-xs">{kind.detail}</span>
          </button>
        ))}
      </div>

      {distance && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="distanceBase">Base addition (₹)</Label>
              <Input
                id="distanceBase"
                value={value.distanceBaseAddition}
                onChange={(e) => onChange({ distanceBaseAddition: e.target.value })}
                inputMode="decimal"
                className="tabular"
              />
              {fieldErrors.distanceBaseAddition ? (
                <span className="text-xs text-[var(--critical-fg)]">{fieldErrors.distanceBaseAddition}</span>
              ) : (
                <span className="text-muted-foreground text-xs">Per unit, at any distance.</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="distanceBlock">Every (km)</Label>
              <Input
                id="distanceBlock"
                value={value.distanceBlockKm}
                onChange={(e) => onChange({ distanceBlockKm: e.target.value })}
                inputMode="decimal"
                className="tabular"
              />
              {fieldErrors.distanceBlockKm ? (
                <span className="text-xs text-[var(--critical-fg)]">{fieldErrors.distanceBlockKm}</span>
              ) : (
                <span className="text-muted-foreground text-xs">Each block started counts.</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="distancePerBlock">Adds (₹)</Label>
              <Input
                id="distancePerBlock"
                value={value.distancePerBlockAddition}
                onChange={(e) => onChange({ distancePerBlockAddition: e.target.value })}
                inputMode="decimal"
                className="tabular"
              />
              {fieldErrors.distancePerBlockAddition ? (
                <span className="text-xs text-[var(--critical-fg)]">
                  {fieldErrors.distancePerBlockAddition}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">Per unit, per block.</span>
              )}
            </div>
          </div>

          {rows && (
            <div className="overflow-x-auto">
              <table className="tabular w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs">
                    <th className="py-1 pr-3 text-left font-medium">Distance</th>
                    {rows.map((row) => (
                      <th key={row.km} className="px-2 py-1 text-right font-medium">
                        {row.km} km
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-muted-foreground py-1 pr-3 text-xs">Adds</td>
                    {rows.map((row) => (
                      <td key={row.km} className="px-2 py-1 text-right">
                        +{formatINR(row.addition)}
                      </td>
                    ))}
                  </tr>
                  {rows[0]?.price && (
                    <tr>
                      <td className="text-muted-foreground py-1 pr-3 text-xs">
                        Price{unitLabel ? ` / ${unitLabel}` : ''}
                      </td>
                      {rows.map((row) => (
                        <td key={row.km} className="px-2 py-1 text-right font-medium">
                          {row.price ? formatINR(row.price) : '—'}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-muted-foreground text-xs">
            Measured by road (estimated) from the nearest warehouse that stocks it. Bulk prices get
            the same addition. A customer who has not set their location sees the 0 km price as a
            &ldquo;from&rdquo; price.
          </p>

          {overMrp && mrp && (
            <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
              From {overMrp.km} km the price is above the MRP of {formatINR(mrp)}. Pre-packed goods
              must not be sold above their printed MRP — check with your CA before selling it this
              way.
            </p>
          )}
        </>
      )}
    </section>
  );
}
