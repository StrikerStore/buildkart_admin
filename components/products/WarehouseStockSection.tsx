'use client';

import Link from 'next/link';
import type { VariantDraft } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SETUP_SECTIONS } from './ProductSetupChecklist';

/**
 * How much of this product each warehouse holds, which decides where it ships
 * from.
 *
 * Separate from the stock count above: that is what customers can buy, and an
 * order takes from it. This is routing only, the same rows Delivery →
 * Warehouses edits. Without any, the nearest warehouse delivers.
 */
export function WarehouseStockSection({
  warehouses,
  variants,
  hasVariants,
  canEdit,
  onVariantChange,
  onAllVariantsChange,
}: {
  warehouses: Array<{ id: string; name: string }>;
  variants: VariantDraft[];
  hasVariants: boolean;
  canEdit: boolean;
  onVariantChange: (index: number, changes: Partial<VariantDraft>) => void;
  onAllVariantsChange: (change: (variant: VariantDraft) => Partial<VariantDraft>) => void;
}) {
  const rows = variants
    .map((variant, index) => ({ variant, index }))
    .filter(({ variant }) => variant.isActive);

  /** The common case: everything sits in one warehouse, as many as the stock count. */
  function allAt(warehouseId: string) {
    onAllVariantsChange((variant) => ({
      warehouseStock: Object.fromEntries(
        warehouses.map((warehouse) => [
          warehouse.id,
          warehouse.id === warehouseId ? String(Number(variant.stockQty || 0)) : '0',
        ]),
      ),
    }));
  }

  const setQty = (index: number, variant: VariantDraft, warehouseId: string, value: string) =>
    onVariantChange(index, {
      warehouseStock: { ...variant.warehouseStock, [warehouseId]: value.replace(/\D/g, '') },
    });

  return (
    <section
      id={SETUP_SECTIONS.warehouses}
      className="bg-card flex scroll-mt-4 flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">Where it ships from</h2>
        <p className="text-muted-foreground text-xs">
          How much each warehouse holds decides which one delivers. Without any, the nearest
          warehouse does. This does not change the stock customers can buy.
        </p>
      </div>

      {!canEdit && (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
          Only the owner can change where it ships from. It is shown here as it is.
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {warehouses.map((warehouse) => (
            <Button
              key={warehouse.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => allAt(warehouse.id)}
            >
              All stock is at {warehouse.name}
            </Button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground bg-muted/40 text-xs">
            <tr>
              {hasVariants && <th className="px-2.5 py-2 font-medium">Variant</th>}
              {warehouses.map((warehouse) => (
                <th key={warehouse.id} className="px-2.5 py-2 font-medium">
                  {warehouse.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ variant, index }) => (
              <tr key={variant.matrixKey}>
                {hasVariants && (
                  <td className="px-2.5 py-2">
                    {variant.optionValues.join(' / ') || 'Default'}
                    <span className="text-muted-foreground block text-xs">
                      {Number(variant.stockQty || 0).toLocaleString('en-IN')} in stock
                    </span>
                  </td>
                )}
                {warehouses.map((warehouse) => (
                  <td key={warehouse.id} className="px-2.5 py-2">
                    {canEdit ? (
                      <Input
                        aria-label={`${warehouse.name}${hasVariants ? `, ${variant.optionValues.join(' / ')}` : ''}`}
                        value={variant.warehouseStock[warehouse.id] ?? ''}
                        onChange={(event) =>
                          setQty(index, variant, warehouse.id, event.target.value)
                        }
                        inputMode="numeric"
                        placeholder="0"
                        className="w-[100px]"
                      />
                    ) : (
                      <span className="tabular-nums">
                        {variant.warehouseStock[warehouse.id] || '0'}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-xs">
        Warehouses themselves are set up under{' '}
        <Link href="/delivery/warehouses" className="underline">
          Delivery → Warehouses
        </Link>
        .
      </p>
    </section>
  );
}
