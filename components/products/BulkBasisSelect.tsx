'use client';

import type { BulkTierBasis } from '@StrikerStore/contract';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * "Bulk pricing works by" — how every rung on this product's ladders is read.
 *
 * One component for the single-variant pricing card and the variant matrix, so
 * the two cannot word the choice differently.
 *
 * **Unit-neutral wording.** It used to say "20 bags or more", which is wrong
 * for everything this shop sells by the cubic metre, tonne or sheet. The unit
 * the product actually uses is shown in the hint below instead, taken from the
 * variant's own unit label.
 */
export function BulkBasisSelect({
  id,
  value,
  onChange,
  unitLabel,
}: {
  id: string;
  value: BulkTierBasis;
  onChange: (next: BulkTierBasis) => void;
  /** The product's unit label ("per bag", "1 cu meter"), for the hint. */
  unitLabel?: string;
}) {
  const unit = unitNoun(unitLabel);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Bulk pricing works by</Label>
      <Select value={value} onValueChange={(next) => onChange(next as BulkTierBasis)}>
        <SelectTrigger id={id} className="sm:w-[320px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="QUANTITY">Quantity ordered — e.g. 10 or more units</SelectItem>
          <SelectItem value="AMOUNT">Order value — e.g. ₹10,000 or more</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">
        {value === 'QUANTITY'
          ? unit
            ? `Counts how many are on one cart line — one unit is “${unit}”.`
            : 'Counts how many are on one cart line.'
          : 'Looks at what one cart line of this item is worth at the normal price.'}
      </p>
    </div>
  );
}

/**
 * "per bag" → "bag", "1 cu meter" → "1 cu meter", "" → null.
 *
 * Only the leading "per" is dropped: it reads as a rate, and the hint wants the
 * thing being counted.
 */
export function unitNoun(label: string | undefined): string | null {
  const trimmed = label?.trim().replace(/^per\s+/i, '') ?? '';
  return trimmed === '' ? null : trimmed;
}
