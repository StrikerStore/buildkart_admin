'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  addMoney,
  distanceAdditionFor,
  formatINR,
  isMoneyString,
  shiftMrp,
  type DistanceParams,
  type PricingKind,
  type VariantDraft,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** The three figures, as a variant draft holds them. */
type DistanceFigures = Pick<
  VariantDraft,
  'distanceBaseAddition' | 'distanceBlockKm' | 'distancePerBlockAddition'
>;

/** The distances the single-variant preview prices at. */
const PREVIEW_KM = [0, 2.5, 5, 7.5, 10, 15, 25];
/** Fewer for the per-variant grid, which has a row per size. */
const GRID_KM = [0, 10, 25];

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

/** The typed figures as engine params, or null while any is not a number yet. */
function paramsOf(figures: DistanceFigures): DistanceParams | null {
  const base = figures.distanceBaseAddition.trim() || '0';
  const perBlock = figures.distancePerBlockAddition.trim() || '0';
  const blockKm = Number(figures.distanceBlockKm);
  if (!isMoneyString(base) || !isMoneyString(perBlock) || !(blockKm >= 0.5)) return null;
  return { baseAddition: base, blockKm, perBlockAddition: perBlock };
}

/**
 * The price and MRP at a distance, worked by the same rules the cart and the
 * storefront use: the MRP rises by the same addition as the price.
 */
function priceAt(variant: VariantDraft, params: DistanceParams, km: number) {
  const addition = distanceAdditionFor(Math.round(km * 1000), params);
  const price = isMoneyString(variant.price.trim())
    ? addMoney(variant.price.trim(), addition)
    : null;
  const mrpValue = variant.compareAtPrice.trim();
  const mrp = isMoneyString(mrpValue) ? shiftMrp(mrpValue, addition) : null;
  return { addition, price, mrp };
}

const nothingAdded = (variant: VariantDraft) => {
  const params = paramsOf(variant);
  return params !== null && distanceAdditionFor(100_000, params) === '0.00';
};

/** Every variant's name as the matrix shows it, "Default" for a product without options. */
const labelOf = (variant: VariantDraft) =>
  variant.optionValues.filter(Boolean).join(' / ') || 'Default';

function FigureInputs({
  idPrefix,
  value,
  onChange,
  compact = false,
}: {
  idPrefix: string;
  value: DistanceFigures;
  onChange: (changes: Partial<DistanceFigures>) => void;
  compact?: boolean;
}) {
  const field = 'tabular' + (compact ? ' w-[88px]' : '');
  return (
    <>
      <Input
        id={`${idPrefix}-base`}
        aria-label="Base addition"
        value={value.distanceBaseAddition}
        onChange={(e) => onChange({ distanceBaseAddition: e.target.value })}
        inputMode="decimal"
        className={field}
      />
      <Input
        id={`${idPrefix}-block`}
        aria-label="Block size in km"
        value={value.distanceBlockKm}
        onChange={(e) => onChange({ distanceBlockKm: e.target.value })}
        inputMode="decimal"
        className={field}
      />
      <Input
        id={`${idPrefix}-per-block`}
        aria-label="Addition per block"
        value={value.distancePerBlockAddition}
        onChange={(e) => onChange({ distancePerBlockAddition: e.target.value })}
        inputMode="decimal"
        className={field}
      />
    </>
  );
}

/**
 * How this product's price behaves with distance.
 *
 * The kind is the product's — it is distance-priced or it is not. The figures
 * are each variant's own, because a 50 kg bag costs more to carry than a 25 kg
 * one: one row per size here, rather than three more columns in the already
 * wide matrix above. Each addition is per unit and sits on top of the list
 * price and every bulk rung.
 */
export function DeliveryPricingSection({
  pricingKind,
  onKindChange,
  variants,
  hasVariants,
  fieldErrors,
  onVariantChange,
  onAllVariantsChange,
}: {
  pricingKind: PricingKind;
  onKindChange: (kind: PricingKind) => void;
  variants: VariantDraft[];
  hasVariants: boolean;
  fieldErrors: Record<string, string>;
  onVariantChange: (index: number, changes: Partial<DistanceFigures>) => void;
  onAllVariantsChange: (changes: DistanceFigures) => void;
}) {
  const distance = pricingKind === 'DISTANCE';
  const [fill, setFill] = useState<DistanceFigures>({
    distanceBaseAddition: '',
    distanceBlockKm: '5',
    distancePerBlockAddition: '',
  });

  const single = variants[0];
  const singleParams = single ? paramsOf(single) : null;
  const unset = distance ? variants.filter(nothingAdded) : [];

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
            aria-checked={pricingKind === kind.value}
            onClick={() => onKindChange(kind.value)}
            className={cn(
              'flex flex-col gap-0.5 rounded-md border p-3 text-left transition-colors',
              pricingKind === kind.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
            )}
          >
            <span className="text-sm font-medium">{kind.title}</span>
            <span className="text-muted-foreground text-xs">{kind.detail}</span>
          </button>
        ))}
      </div>

      {distance && !hasVariants && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="distance-0-base">Base addition (₹)</Label>
              <Input
                id="distance-0-base"
                value={single?.distanceBaseAddition ?? ''}
                onChange={(e) => onVariantChange(0, { distanceBaseAddition: e.target.value })}
                inputMode="decimal"
                className="tabular"
              />
              <span className="text-muted-foreground text-xs">
                Per unit. Covers the first {single?.distanceBlockKm.trim() || '…'} km.
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="distance-0-block">Every (km)</Label>
              <Input
                id="distance-0-block"
                value={single?.distanceBlockKm ?? ''}
                onChange={(e) => onVariantChange(0, { distanceBlockKm: e.target.value })}
                inputMode="decimal"
                className="tabular"
              />
              <span className="text-muted-foreground text-xs">
                Each further block started adds.
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="distance-0-per-block">Adds (₹)</Label>
              <Input
                id="distance-0-per-block"
                value={single?.distancePerBlockAddition ?? ''}
                onChange={(e) => onVariantChange(0, { distancePerBlockAddition: e.target.value })}
                inputMode="decimal"
                className="tabular"
              />
              <span className="text-muted-foreground text-xs">
                Per unit, per block after the first.
              </span>
            </div>
          </div>

          {single && singleParams && (
            <div className="overflow-x-auto">
              <table className="tabular w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs">
                    <th className="py-1 pr-3 text-left font-medium">Distance</th>
                    {PREVIEW_KM.map((km) => (
                      <th key={km} className="px-2 py-1 text-right font-medium">
                        {km} km
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-muted-foreground py-1 pr-3 text-xs">Adds</td>
                    {PREVIEW_KM.map((km) => (
                      <td key={km} className="px-2 py-1 text-right">
                        +{formatINR(priceAt(single, singleParams, km).addition)}
                      </td>
                    ))}
                  </tr>
                  {isMoneyString(single.price.trim()) && (
                    <tr>
                      <td className="text-muted-foreground py-1 pr-3 text-xs">
                        Price{single.unitLabelEn ? ` / ${single.unitLabelEn}` : ''}
                      </td>
                      {PREVIEW_KM.map((km) => (
                        <td key={km} className="px-2 py-1 text-right font-medium">
                          {formatINR(priceAt(single, singleParams, km).price!)}
                        </td>
                      ))}
                    </tr>
                  )}
                  {isMoneyString(single.compareAtPrice.trim()) && (
                    <tr>
                      <td className="text-muted-foreground py-1 pr-3 text-xs">MRP</td>
                      {PREVIEW_KM.map((km) => (
                        <td key={km} className="text-muted-foreground px-2 py-1 text-right">
                          {formatINR(priceAt(single, singleParams, km).mrp!)}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {distance && hasVariants && variants.length === 0 && (
        <p className="text-muted-foreground text-xs">
          Add option values above, then set what each size adds here.
        </p>
      )}

      {distance && hasVariants && variants.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Fill every row at once — most products add the same per block. */}
          <div className="bg-muted/50 flex flex-wrap items-end gap-2 rounded-md p-2">
            <span className="text-muted-foreground w-full text-xs font-medium">
              Same for all variants
            </span>
            <FigureInputs
              idPrefix="distance-fill"
              value={fill}
              onChange={(changes) => setFill((current) => ({ ...current, ...changes }))}
              compact
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paramsOf(fill) === null}
              onClick={() => onAllVariantsChange(fill)}
            >
              Apply to all
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs">
                  <th className="py-1 pr-2 text-left font-medium">Variant</th>
                  <th className="px-1 py-1 text-left font-medium">Base (₹)</th>
                  <th className="px-1 py-1 text-left font-medium">Every (km)</th>
                  <th className="px-1 py-1 text-left font-medium">Adds (₹)</th>
                  {GRID_KM.map((km) => (
                    <th key={km} className="px-2 py-1 text-right font-medium">
                      at {km} km
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variants.map((variant, index) => {
                  const params = paramsOf(variant);
                  return (
                    <tr key={variant.matrixKey} className="border-t">
                      <td className="py-1.5 pr-2">
                        <span className="block font-medium">{labelOf(variant)}</span>
                        {isMoneyString(variant.price.trim()) && (
                          <span className="text-muted-foreground text-xs">
                            {formatINR(variant.price.trim())}
                          </span>
                        )}
                      </td>
                      {(
                        [
                          ['distanceBaseAddition', 'base addition'],
                          ['distanceBlockKm', 'block size in km'],
                          ['distancePerBlockAddition', 'addition per block'],
                        ] as const
                      ).map(([key, label]) => (
                        <td key={key} className="px-1 py-1.5">
                          <Input
                            aria-label={`${labelOf(variant)} ${label}`}
                            value={variant[key]}
                            onChange={(e) => onVariantChange(index, { [key]: e.target.value })}
                            inputMode="decimal"
                            className="tabular w-[88px]"
                          />
                        </td>
                      ))}
                      {GRID_KM.map((km) => {
                        const at = params ? priceAt(variant, params, km) : null;
                        return (
                          <td key={km} className="px-2 py-1.5 text-right">
                            {at === null
                              ? '—'
                              : at.price !== null
                                ? formatINR(at.price)
                                : `+${formatINR(at.addition)}`}
                            {at?.mrp && (
                              <span className="text-muted-foreground block text-xs">
                                MRP {formatINR(at.mrp)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {distance && (
        <>
          {fieldErrors.variants && (
            <span className="text-xs text-[var(--critical-fg)]">{fieldErrors.variants}</span>
          )}

          <p className="text-muted-foreground text-xs">
            The base covers the first block (0 km up to &ldquo;Every&rdquo;); each further block
            started adds &ldquo;Adds&rdquo;. Measured by road (estimated) from the nearest warehouse
            that stocks the variant. Bulk prices and the MRP shown rise by the same amount, so the
            saving stays the same. A customer who has not set their location sees the 0 km price as
            a &ldquo;from&rdquo; price.
          </p>

          {unset.length > 0 && (
            <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
              Nothing is added for distance on {unset.map(labelOf).join(', ')} — those sell at the
              same price however far they go, with free delivery.
            </p>
          )}
        </>
      )}
    </section>
  );
}
