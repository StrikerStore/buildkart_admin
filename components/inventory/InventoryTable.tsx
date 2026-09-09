'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircleIcon, MinusIcon, PlusIcon, AlertTriangleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { adjustStock } from '@/app/(dashboard)/inventory/actions';

export type InventoryRow = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  unitLabel: string | null;
  stockQty: number;
  lowStockThreshold: number;
  isLow: boolean;
  isOut: boolean;
};

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<InventoryRow | null>(null);
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, startSaving] = useTransition();

  function open(row: InventoryRow) {
    setTarget(row);
    setDelta('');
    setNote('');
  }

  function submit(signedDelta: number) {
    if (!target || signedDelta === 0) return;

    startSaving(async () => {
      const result = await adjustStock({
        variantId: target.variantId,
        delta: signedDelta,
        note,
      });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not adjust stock.');
        return;
      }
      toast.success(`${target.productName} is now ${result.data.stockQty} in stock`);
      setTarget(null);
      router.refresh();
    });
  }

  const amount = Number(delta);
  const valid = Number.isFinite(amount) && amount > 0;

  return (
    <>
      <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
        <div className="text-muted-foreground bg-muted/40 flex items-center gap-3 border-b px-3 py-2 text-xs font-medium">
          <span className="min-w-0 flex-1">Product</span>
          <span className="hidden w-[90px] shrink-0 text-right sm:block">Alert at</span>
          <span className="w-[90px] shrink-0 text-right">In stock</span>
          <span className="w-[92px] shrink-0" />
        </div>

        <ul>
          {rows.map((row) => (
            <li
              key={row.variantId}
              className={cn(
                'flex items-center gap-3 border-b px-3 py-2 last:border-b-0',
                row.isOut && 'bg-[var(--critical-bg)]',
              )}
            >
              <span className="min-w-0 flex-1">
                <Link
                  href={`/products/${row.productId}`}
                  className="block truncate font-medium hover:underline"
                >
                  {row.productName}
                </Link>
                <span className="text-muted-foreground block truncate text-xs">
                  {[row.variantLabel, row.sku].filter(Boolean).join(' · ') || row.unitLabel || ''}
                </span>
              </span>

              <span className="text-muted-foreground tabular hidden w-[90px] shrink-0 text-right text-xs sm:block">
                {row.lowStockThreshold > 0 ? row.lowStockThreshold : '—'}
              </span>

              <span
                className={cn(
                  'tabular w-[90px] shrink-0 text-right font-medium',
                  row.isOut
                    ? 'text-[var(--critical-fg)]'
                    : row.isLow
                      ? 'text-[var(--warning-fg)]'
                      : undefined,
                )}
              >
                {row.isOut && <AlertTriangleIcon className="mr-1 inline size-3.5" />}
                {row.stockQty}
              </span>

              <span className="w-[92px] shrink-0 text-right">
                <Button type="button" variant="outline" size="sm" onClick={() => open(row)}>
                  Adjust
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={target !== null} onOpenChange={(next) => !next && setTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="truncate">{target?.productName}</DialogTitle>
            <DialogDescription>
              {target?.stockQty} in stock now.
              {target?.variantLabel ? ` ${target.variantLabel}.` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delta">How many</Label>
            <Input
              id="delta"
              autoFocus
              value={delta}
              onChange={(e) => setDelta(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              placeholder="12"
              className="tabular"
            />
            <p className="text-muted-foreground text-xs">
              {/* A delta, not a new total: it is how a physical count is
                  reported, and it cannot overwrite a sale made a second ago. */}
              Enter the change, not the new total. Received stock adds, damage or shrinkage removes.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Delivery from supplier"
              maxLength={255}
            />
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={!valid || isSaving}
              onClick={() => submit(-amount)}
              className="text-[var(--critical-fg)] hover:text-[var(--critical-fg)]"
            >
              {isSaving ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <MinusIcon className="size-4" />
              )}
              Remove {valid ? amount : ''}
            </Button>
            <Button type="button" disabled={!valid || isSaving} onClick={() => submit(amount)}>
              {isSaving ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <PlusIcon className="size-4" />
              )}
              Add {valid ? amount : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
