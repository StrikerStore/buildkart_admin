'use client';

import Link from 'next/link';
import {
  QUOTE_MATERIAL_LABELS,
  QUOTE_MATERIAL_UNITS,
  QUOTE_MATERIALS,
  suggestCoverage,
  type QuoteMaterial,
  type VariantDraft,
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
import { SETUP_SECTIONS, saleUnitWord } from './ProductSetupChecklist';

const NONE = '__none__';
const BASE_UNIT_WORDS = { kg: 'kg', cft: 'cft', piece: 'pieces', sqft: 'sq ft' } as const;

const EXAMPLES: Record<QuoteMaterial, string> = {
  CEMENT: 'A 50 kg bag covers 50.',
  SAND: 'Sold per cft, 1. Per brass, 100.',
  AGGREGATE: 'Sold per cft, 1. Per brass, 100.',
  STEEL: 'Sold per kg, 1. Per quintal, 100.',
  BRICK: 'Sold per piece, 1. Per thousand, 1000.',
  BLOCK: 'Sold per piece, 1.',
  TILE: 'A box that lays 15.5 sq ft covers 15.5.',
  TILE_ADHESIVE: 'A 20 kg bag covers 20.',
};

/**
 * Whether the website's Get a quote calculator offers this product, and what one
 * sale unit of it covers.
 *
 * The same link the Quote materials screen makes, set where the product is made
 * so a new cement does not need a second trip. That screen still decides which
 * brand is offered first.
 */
export function QuoteMaterialSection({
  material,
  onMaterialChange,
  variants,
  hasVariants,
  productName,
  onVariantChange,
  onAllVariantsChange,
}: {
  material: QuoteMaterial | null;
  onMaterialChange: (next: QuoteMaterial | null) => void;
  variants: VariantDraft[];
  hasVariants: boolean;
  productName: string;
  onVariantChange: (index: number, changes: Partial<VariantDraft>) => void;
  onAllVariantsChange: (changes: Partial<VariantDraft>) => void;
}) {
  const rows = variants
    .map((variant, index) => ({ variant, index }))
    .filter(({ variant }) => variant.isActive);
  const base = material ? BASE_UNIT_WORDS[QUOTE_MATERIAL_UNITS[material]] : '';

  const suggestionFor = (next: QuoteMaterial, variant: VariantDraft) =>
    suggestCoverage(next, variant.unitLabelEn, productName, variant.optionValues.join(' '));

  /** Choosing a material fills any blank coverage with a suggestion to confirm. */
  function choose(value: string) {
    const next = value === NONE ? null : (value as QuoteMaterial);
    onMaterialChange(next);
    if (!next) return;
    for (const { variant, index } of rows) {
      if (variant.quoteCoverage.trim() !== '') continue;
      const suggestion = suggestionFor(next, variant);
      if (suggestion) onVariantChange(index, { quoteCoverage: suggestion });
    }
  }

  const firstValue = rows[0]?.variant.quoteCoverage ?? '';

  return (
    <section
      id={SETUP_SECTIONS.quote}
      className="bg-card flex scroll-mt-4 flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">Get a quote</h2>
        <p className="text-muted-foreground text-xs">
          Lets the website’s material calculator offer this product, and work out how many to
          buy.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quoteMaterial">Used in Get a quote as</Label>
        <Select value={material ?? NONE} onValueChange={choose}>
          <SelectTrigger id="quoteMaterial" className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not used</SelectItem>
            {QUOTE_MATERIALS.map((value) => (
              <SelectItem key={value} value={value}>
                {QUOTE_MATERIAL_LABELS[value].en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {material && (
        <>
          {!hasVariants && rows[0] ? (
            <CoverageField
              id="quoteCoverage"
              label={`One ${saleUnitWord(rows[0].variant.unitLabelEn)} covers`}
              base={base}
              value={rows[0].variant.quoteCoverage}
              onChange={(value) => onVariantChange(rows[0]!.index, { quoteCoverage: value })}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>What one of each covers ({base})</Label>
                {rows.length > 1 && firstValue.trim() !== '' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAllVariantsChange({ quoteCoverage: firstValue })}
                  >
                    Same for all
                  </Button>
                )}
              </div>
              <ul className="divide-y rounded-md border">
                {rows.map(({ variant, index }) => (
                  <li key={variant.matrixKey} className="flex items-center gap-3 px-2.5 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {variant.optionValues.join(' / ') || 'Default'}
                      <span className="text-muted-foreground">
                        {' '}
                        · one {saleUnitWord(variant.unitLabelEn)}
                      </span>
                    </span>
                    <Input
                      aria-label={`What one ${variant.optionValues.join(' / ')} covers, in ${base}`}
                      value={variant.quoteCoverage}
                      onChange={(event) => onVariantChange(index, { quoteCoverage: event.target.value })}
                      inputMode="decimal"
                      className="w-[110px]"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-muted-foreground text-xs">
            Measured in {base}. {EXAMPLES[material]} Which brand is offered first is set on{' '}
            <Link href="/quote-materials" className="underline">
              Quote materials
            </Link>
            .
          </p>
        </>
      )}
    </section>
  );
}

function CoverageField({
  id,
  label,
  base,
  value,
  onChange,
}: {
  id: string;
  label: string;
  base: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          className="w-[140px]"
        />
        <span className="text-muted-foreground text-sm">{base}</span>
      </div>
    </div>
  );
}
