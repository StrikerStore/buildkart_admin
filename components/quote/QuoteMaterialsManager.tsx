'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import {
  QUOTE_MATERIAL_LABELS,
  QUOTE_MATERIAL_UNITS,
  QUOTE_MATERIALS,
  type QuoteMaterial,
  type QuoteMaterialsFormDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  deleteQuoteMaterial,
  reorderQuoteMaterial,
  saveQuoteMaterial,
} from '@/app/(dashboard)/quote-materials/actions';

const UNIT_LABELS = { kg: 'kg', cft: 'cft', piece: 'pieces', sqft: 'sq ft' } as const;

/** The owner's own question, answered with an example, because this number decides quantities. */
const EXAMPLES: Record<QuoteMaterial, string> = {
  CEMENT: 'A 50 kg bag covers 50.',
  SAND: 'One brass covers 100. Sold per cft, 1.',
  AGGREGATE: 'One brass covers 100. Sold per cft, 1.',
  STEEL: 'Sold per kg, 1. Sold per quintal, 100.',
  BRICK: 'Sold per piece, 1. Sold per thousand, 1000.',
  BLOCK: 'Sold per piece, 1.',
  TILE: 'A box that lays 15.5 sq ft covers 15.5.',
  TILE_ADHESIVE: 'A 20 kg bag covers 20.',
};

function MaterialCard({
  material,
  options,
  variants,
}: {
  material: QuoteMaterial;
  options: QuoteMaterialsFormDto['options'];
  variants: QuoteMaterialsFormDto['variants'];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [variantId, setVariantId] = useState('');
  const [covers, setCovers] = useState('');
  const [error, setError] = useState<string | null>(null);

  const unit = UNIT_LABELS[QUOTE_MATERIAL_UNITS[material]];

  function run(action: () => Promise<{ ok: boolean; formErrors?: string[]; fieldErrors?: Record<string, string> }>, done?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        const message =
          result.fieldErrors?.baseUnitsPerSaleUnit ??
          result.formErrors?.[0] ??
          'Could not save that. Try again.';
        setError(message);
        toast.error(message);
        return;
      }
      done?.();
      router.refresh();
    });
  }

  function add() {
    if (!variantId) return;
    run(
      () => saveQuoteMaterial({ material, variantId, baseUnitsPerSaleUnit: covers }),
      () => {
        setVariantId('');
        setCovers('');
      },
    );
  }

  function moveUp(index: number) {
    const ids = options.map((row) => row.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index - 1, 0, moved!);
    run(() => reorderQuoteMaterial({ material, ids }));
  }

  // Not what is already linked here: moving a variant between materials is a
  // decision worth making on the row it is on.
  const linked = new Set(options.map((row) => row.variantId));
  const available = variants.filter((variant) => !linked.has(variant.variantId));

  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div>
        <h2 className="font-semibold">{QUOTE_MATERIAL_LABELS[material].en}</h2>
        <p className="text-muted-foreground text-xs">
          Measured in {unit}. {EXAMPLES[material]}
        </p>
      </div>

      {options.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {options.map((row, index) => (
            <li key={row.id} className="flex items-center gap-2 px-2.5 py-2">
              <span className="min-w-0 flex-1">
                <Link
                  href={`/products/${row.productId}#setup-quote`}
                  className="block truncate font-medium hover:underline"
                >
                  {row.label}
                </Link>
                <span className="text-muted-foreground block text-xs">
                  One {row.unitLabel ? row.unitLabel.replace(/^per /, '') : 'unit'} covers{' '}
                  {row.baseUnitsPerSaleUnit} {unit}
                  {index === 0 ? ' · offered first' : ''}
                </span>
                {!row.live && (
                  <span className="block text-xs text-[var(--warning-fg)]">
                    Not on sale, so the calculator will not offer it.
                  </span>
                )}
              </span>
              {index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveUp(index)}
                  disabled={pending}
                  aria-label={`Move ${row.label} up`}
                >
                  <ArrowUpIcon className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => run(() => deleteQuoteMaterial(row.id))}
                disabled={pending}
                aria-label={`Remove ${row.label}`}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">
          Nothing linked. Customers see the quantity and “ask for a rate”.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <Label htmlFor={`${material}-variant`}>Product</Label>
          <Select value={variantId} onValueChange={setVariantId}>
            <SelectTrigger id={`${material}-variant`}>
              <SelectValue placeholder="Choose a product" />
            </SelectTrigger>
            <SelectContent>
              {available.map((variant) => (
                <SelectItem key={variant.variantId} value={variant.variantId}>
                  {variant.label}
                  {variant.unitLabel ? ` (${variant.unitLabel})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[130px] flex-col gap-1.5">
          <Label htmlFor={`${material}-covers`}>One covers ({unit})</Label>
          <Input
            id={`${material}-covers`}
            value={covers}
            onChange={(event) => setCovers(event.target.value)}
            inputMode="decimal"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={pending || !variantId || covers.trim() === ''}
        >
          <PlusIcon className="size-4" />
          Add
        </Button>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}
    </section>
  );
}

export function QuoteMaterialsManager({ form }: { form: QuoteMaterialsFormDto }) {
  return (
    <div className="flex flex-col gap-4">
      {QUOTE_MATERIALS.map((material) => (
        <MaterialCard
          key={material}
          material={material}
          options={form.options.filter((row) => row.material === material)}
          variants={form.variants}
        />
      ))}
    </div>
  );
}
