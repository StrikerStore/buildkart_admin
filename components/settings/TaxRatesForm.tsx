'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { TaxRateDto } from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { deleteTaxRate, saveTaxRate } from '@/app/(dashboard)/settings/tax/actions';
import { cn } from '@/lib/utils';

type Draft = { id: string | null; name: string; percent: string; isDefault: boolean; isActive: boolean };

const blank = (): Draft => ({ id: null, name: '', percent: '', isDefault: false, isActive: true });

/**
 * The rate list.
 *
 * Editing in place rather than on a detail page: there are five of these, they
 * are two fields each, and a round trip to another screen to change "18" to
 * "12" would be most of the work of doing it.
 */
export function TaxRatesForm({ rates }: { rates: TaxRateDto[] }) {
  const [adding, setAdding] = useState<Draft | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col divide-y rounded-md border">
        {rates.length === 0 && !adding && (
          <p className="text-muted-foreground px-3 py-6 text-center text-xs">
            No rates yet. Add the slabs your catalogue uses.
          </p>
        )}

        {rates.map((rate) => (
          <RateRow key={rate.id} rate={rate} />
        ))}

        {adding && <RateRow draft={adding} onCancel={() => setAdding(null)} />}
      </div>

      {!adding && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setAdding(blank())}
        >
          <PlusIcon className="size-4" />
          Add a rate
        </Button>
      )}
    </div>
  );
}

function RateRow({
  rate,
  draft,
  onCancel,
}: {
  rate?: TaxRateDto;
  draft?: Draft;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Draft>(
    draft ?? {
      id: rate!.id,
      name: rate!.name,
      // Trailing zeros trimmed: the field shows "18", not "18.00".
      percent: String(Number(rate!.percent)),
      isDefault: rate!.isDefault,
      isActive: rate!.isActive,
    },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const inUse = (rate?.productCount ?? 0) > 0;

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveTaxRate(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success(inUse ? `Saved — ${rate!.productCount} product(s) repriced` : 'Saved');
      onCancel?.();
      router.refresh();
    });
  }

  function remove() {
    startDeleting(async () => {
      const result = await deleteTaxRate({ id: form.id });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not delete that rate.');
        return;
      }
      toast.success('Rate deleted');
      router.refresh();
    });
  }

  return (
    <div className={cn('flex flex-col gap-3 px-3 py-3', !form.isActive && 'opacity-60')}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <Label htmlFor={`name-${form.id ?? 'new'}`}>Name</Label>
          <Input
            id={`name-${form.id ?? 'new'}`}
            value={form.name}
            onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            placeholder="GST 18%"
          />
          {errors.name && <span className="text-xs text-[var(--critical-fg)]">{errors.name}</span>}
        </div>

        <div className="flex w-[110px] flex-col gap-1.5">
          <Label htmlFor={`pct-${form.id ?? 'new'}`}>Rate</Label>
          <div className="relative">
            <Input
              id={`pct-${form.id ?? 'new'}`}
              value={form.percent}
              onChange={(e) => setForm((c) => ({ ...c, percent: e.target.value }))}
              inputMode="decimal"
              className="tabular pr-7"
            />
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
              %
            </span>
          </div>
          {errors.percent && (
            <span className="text-xs text-[var(--critical-fg)]">{errors.percent}</span>
          )}
        </div>

        <Button type="button" size="sm" disabled={isSaving} onClick={save}>
          {isSaving ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          Save
        </Button>

        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          /* Deleting is offered only for a rate nothing uses; one with history
             is turned off instead, so past orders keep naming it. */
          !inUse && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              onClick={remove}
              aria-label={`Delete ${form.name}`}
            >
              <Trash2Icon className="size-4" />
            </Button>
          )
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={form.isDefault}
            onCheckedChange={(v) => setForm((c) => ({ ...c, isDefault: v }))}
          />
          Use for new products
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => setForm((c) => ({ ...c, isActive: v }))}
          />
          Offered on the product form
        </label>

        {rate && (
          <span className="text-muted-foreground text-xs">
            {rate.productCount === 0
              ? 'Not used by any product'
              : `On ${rate.productCount} product${rate.productCount === 1 ? '' : 's'} — saving reprices them all`}
          </span>
        )}
      </div>
    </div>
  );
}
