'use client';

import { PlusIcon, XIcon } from 'lucide-react';
import {
  MAX_PRICE_TIERS,
  formatINR,
  validateTierLadder,
  type BulkTierBasis,
  type PriceTierDraft,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * A variant's bulk ladder — "20+ bags at ₹370, 40+ at ₹365".
 *
 * Fully controlled, like `CategoryRuleBuilder`: the rows live in the form that
 * owns the variant, so one Save writes the price and its ladder together and
 * there is no half-saved state where a rung exists for a price that changed.
 *
 * **Add and remove only, deliberately no reordering.** A rung's place in the
 * ladder is decided by its threshold, not by where it sits in the list — arrows
 * would let an owner arrange a ladder whose display order contradicts its own
 * arithmetic. Rows are sorted by threshold on save instead.
 *
 * The problems shown under the rows come from `validateTierLadder`, the same
 * function the server runs. Mirrored here rather than reimplemented, because
 * the server rejects the whole product on one bad rung and losing a screen of
 * typing to a typo in the third row is a bad trade.
 */
export function PriceTierEditor({
  basis,
  listPrice,
  tiers,
  onTiersChange,
}: {
  basis: BulkTierBasis;
  /** The price each rung has to beat, so a saving can be shown per row. */
  listPrice: string;
  tiers: PriceTierDraft[];
  onTiersChange: (next: PriceTierDraft[]) => void;
}) {
  const problems = validateTierLadder(basis, listPrice, tiers);
  const quantity = basis === 'QUANTITY';

  function update(index: number, changes: Partial<PriceTierDraft>) {
    onTiersChange(tiers.map((tier, i) => (i === index ? { ...tier, ...changes } : tier)));
  }

  /** What one unit saves at this rung, for the hint beside the row. */
  function savingFor(tier: PriceTierDraft): string | null {
    const list = Number(listPrice);
    const rate = Number(tier.unitPrice);
    if (!Number.isFinite(list) || !Number.isFinite(rate) || rate <= 0 || rate >= list) return null;
    return formatINR((list - rate).toFixed(2));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <Label>Bulk price breaks</Label>
        <p className="text-muted-foreground text-xs">
          {quantity
            ? 'Charged automatically once this many units are on one line.'
            : 'Charged automatically once one line of this item is worth this much.'}
        </p>
      </div>

      {tiers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {tiers.map((tier, index) => {
            const saving = savingFor(tier);
            return (
              <li key={index} className="flex items-center gap-2">
                <span className="text-muted-foreground w-12 shrink-0 text-xs">
                  {quantity ? 'From' : 'Over'}
                </span>
                <Input
                  value={tier.threshold}
                  onChange={(e) => update(index, { threshold: e.target.value })}
                  inputMode="decimal"
                  placeholder={quantity ? '20' : '10000'}
                  aria-label={`Break ${index + 1} ${quantity ? 'quantity' : 'order value'}`}
                  className="tabular h-9 w-24"
                />
                <span className="text-muted-foreground shrink-0 text-xs">at ₹</span>
                <Input
                  value={tier.unitPrice}
                  onChange={(e) => update(index, { unitPrice: e.target.value })}
                  inputMode="decimal"
                  placeholder="370"
                  aria-label={`Break ${index + 1} rate`}
                  className="tabular h-9 w-24"
                />
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                  {saving ? `saves ${saving} each` : ''}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onTiersChange(tiers.filter((_, i) => i !== index))}
                  aria-label={`Remove price break ${index + 1}`}
                >
                  <XIcon className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {tiers.length < MAX_PRICE_TIERS && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onTiersChange([...tiers, { threshold: '', unitPrice: '' }])}
          >
            <PlusIcon className="size-4" />
            {tiers.length === 0 ? 'Add a bulk price' : 'Add another break'}
          </Button>
        </div>
      )}

      {problems.length > 0 && (
        <ul className={cn('flex flex-col gap-0.5 text-xs', 'text-[var(--critical-fg)]')}>
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
