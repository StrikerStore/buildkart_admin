'use client';

import {
  MONEY_PATTERN,
  discountPercent,
  formatINR,
  type BulkTierBasis,
  type VariantDraft,
} from '@StrikerStore/contract';
import { PriceTierEditor } from './PriceTierEditor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Money inputs are `type="text"` with `inputMode="decimal"`, never
 * `type="number"`. Many Android keyboards drop the decimal separator on a
 * number input, and this catalog is entered on a budget Android phone — a price
 * field that silently refuses "410.50" is a real failure, not a theoretical one.
 */
function MoneyInput({
  id,
  label,
  value,
  onChange,
  error,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2">₹</span>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="tabular pl-6"
          aria-invalid={Boolean(error)}
        />
      </div>
      {error ? (
        <p className="text-[var(--critical-fg)] text-xs">{error}</p>
      ) : help ? (
        <p className="text-muted-foreground text-xs">{help}</p>
      ) : null}
    </div>
  );
}

/** What the single-variant editors share. */
type SingleVariantProps = {
  variant: VariantDraft;
  onChange: (changes: Partial<VariantDraft>) => void;
  fieldErrors: Record<string, string>;
};

/** Pricing also owns the bulk ladder, whose basis belongs to the product. */
type PricingProps = SingleVariantProps & {
  bulkTierBasis: BulkTierBasis;
  onBasisChange: (next: BulkTierBasis) => void;
};

/**
 * Pricing for a product with no option axes — a single variant row edited
 * through friendly full-width fields rather than the dense matrix table, which
 * only earns its density once there are many rows.
 *
 * Split from `InventorySection` below, which it used to render alongside: the
 * tax card belongs between the two, because deciding what a thing costs and
 * deciding what tax sits inside that price are one thought, and counting the
 * stock is a different one.
 */
export function PricingSection({
  variant,
  onChange,
  bulkTierBasis,
  onBasisChange,
  fieldErrors,
}: PricingProps) {
  const validPrice = MONEY_PATTERN.test(variant.price);
  const validCost = MONEY_PATTERN.test(variant.costPerItem);

  // Live margin while typing is the difference between pricing and guessing.
  const margin =
    validPrice && validCost && Number(variant.price) > 0
      ? Math.round(
          ((Number(variant.price) - Number(variant.costPerItem)) / Number(variant.price)) * 100,
        )
      : null;
  const off = validPrice ? discountPercent(variant.price, variant.compareAtPrice || null) : null;

  return (
    <>
      <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-semibold">Pricing</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput
            id="price"
            label="Price"
            value={variant.price}
            onChange={(v) => onChange({ price: v })}
            error={fieldErrors.variants}
          />
          <MoneyInput
            id="compareAt"
            label="MRP (crossed out)"
            value={variant.compareAtPrice}
            onChange={(v) => onChange({ compareAtPrice: v })}
            help={off !== null ? `Shows as ${off}% off` : 'Leave blank if there is no discount'}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput
            id="cost"
            label="Cost per item"
            value={variant.costPerItem}
            onChange={(v) => onChange({ costPerItem: v })}
            help={
              margin !== null
                ? `Margin ${margin}%. Never shown to customers.`
                : 'Never shown to customers.'
            }
          />
        </div>

        {/*
          * The bulk ladder, and how its thresholds are read.
          *
          * The basis sits above the rungs because changing it reinterprets
          * every one of them — 20 bags and ₹20 are the same digits — so the
          * ladder clears when it changes rather than silently keeping numbers
          * that now mean something else.
          */}
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulkBasis">Bulk pricing works by</Label>
            <Select
              value={bulkTierBasis}
              onValueChange={(next) => onBasisChange(next as BulkTierBasis)}
            >
              <SelectTrigger id="bulkBasis" className="sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QUANTITY">Quantity on the line — 20 bags or more</SelectItem>
                <SelectItem value="AMOUNT">Value of the line — ₹10,000 or more</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <PriceTierEditor
            basis={bulkTierBasis}
            listPrice={variant.price}
            tiers={variant.tiers}
            onTiersChange={(tiers) => onChange({ tiers })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unitEn">Unit label</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              id="unitEn"
              value={variant.unitLabelEn}
              onChange={(e) => onChange({ unitLabelEn: e.target.value })}
              placeholder="per bag"
              maxLength={32}
            />
            <Input
              value={variant.unitLabelHi}
              onChange={(e) => onChange({ unitLabelHi: e.target.value })}
              placeholder="प्रति बोरी"
              lang="hi"
              maxLength={32}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Shown next to the price, e.g. {formatINR(validPrice ? variant.price : '410')}
            {variant.unitLabelEn ? ` / ${variant.unitLabelEn}` : ' / bag'}
          </p>
        </div>
      </section>
    </>
  );
}

/**
 * Stock, SKU and the out-of-stock policy for a product with no option axes.
 * Rendered after tax, so the left column reads: pricing, tax, inventory.
 */
export function InventorySection({ variant, onChange, fieldErrors }: SingleVariantProps) {
  return (
    <>
      <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-semibold">Inventory</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={variant.sku}
              onChange={(e) => onChange({ sku: e.target.value })}
              className="font-mono"
              maxLength={64}
            />
            <p className="text-muted-foreground text-xs">
              Filled in from the product name if you leave it blank.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              value={variant.barcode}
              onChange={(e) => onChange({ barcode: e.target.value })}
              className="font-mono"
              maxLength={64}
            />
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 border-t pt-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="tracked" className="font-medium">
              Track quantity
            </Label>
            <p className="text-muted-foreground text-xs">
              Stock drops automatically as orders come in.
            </p>
          </div>
          <Switch
            id="tracked"
            checked={variant.inventoryTracked}
            onCheckedChange={(v) => onChange({ inventoryTracked: v })}
          />
        </div>

        {variant.inventoryTracked && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stock">Quantity in stock</Label>
                <Input
                  id="stock"
                  value={variant.stockQty}
                  onChange={(e) => onChange({ stockQty: e.target.value.replace(/\D/g, '') })}
                  inputMode="numeric"
                  className="tabular"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lowStock">Low-stock alert at</Label>
                <Input
                  id="lowStock"
                  value={variant.lowStockThreshold}
                  onChange={(e) =>
                    onChange({ lowStockThreshold: e.target.value.replace(/\D/g, '') })
                  }
                  inputMode="numeric"
                  className="tabular"
                />
                <p className="text-muted-foreground text-xs">0 turns the alert off.</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="policy">When stock runs out</Label>
              <Select
                value={variant.inventoryPolicy}
                onValueChange={(v) => onChange({ inventoryPolicy: v as 'DENY' | 'CONTINUE' })}
              >
                <SelectTrigger id="policy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DENY">Stop selling</SelectItem>
                  <SelectItem value="CONTINUE">Keep selling (order on demand)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </section>
    </>
  );
}
