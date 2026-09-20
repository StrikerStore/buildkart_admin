'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { chargeForLeg, formatINR, type DistancePricingConfig } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { saveDistancePricing } from '@/app/(dashboard)/delivery/actions';

export type DistancePricingValues = {
  enabled: boolean;
  roadFactor: number;
  blockKm: number;
  perBlockCharge: string;
  standardThreshold: string;
  standardFreeKm: number;
  highValueThreshold: string;
  highValueFreeKm: number;
  smallOrderFee: string;
  smallOrderIncludedKm: number;
  maxCharge: string | null;
};

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <span className="text-xs text-[var(--critical-fg)]">{error}</span>
      ) : (
        hint && <span className="text-muted-foreground text-xs">{hint}</span>
      )}
    </div>
  );
}

export function DistancePricingForm({ initial }: { initial: DistancePricingValues }) {
  const router = useRouter();
  const [form, setForm] = useState({
    enabled: initial.enabled,
    roadFactor: String(initial.roadFactor),
    blockKm: String(initial.blockKm),
    perBlockCharge: initial.perBlockCharge,
    standardThreshold: initial.standardThreshold,
    standardFreeKm: String(initial.standardFreeKm),
    highValueThreshold: initial.highValueThreshold,
    highValueFreeKm: String(initial.highValueFreeKm),
    smallOrderFee: initial.smallOrderFee,
    smallOrderIncludedKm: String(initial.smallOrderIncludedKm),
    maxCharge: initial.maxCharge ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  /* The preview's own inputs — a basket value and a distance to try. */
  const [trySubtotal, setTrySubtotal] = useState('1200');
  const [tryKm, setTryKm] = useState('17');

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveDistancePricing(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Delivery charges saved');
      router.refresh();
    });
  }

  /*
   * The preview runs the real rule, not a copy of it.
   *
   * `chargeForLeg` is the same pure function the cart calls, exported through
   * the contract — eleven numbers interact here, and an admin needs to watch
   * ₹1,200 at 17 km come out as ₹100 before they will trust the screen. A
   * second implementation for the preview would eventually disagree with the
   * one that charges money, and the preview is where that would be believed.
   */
  const preview = (() => {
    const config: DistancePricingConfig = {
      enabled: true,
      roadFactor: Number(form.roadFactor),
      blockKm: Number(form.blockKm),
      perBlockCharge: form.perBlockCharge,
      standardThreshold: form.standardThreshold,
      standardFreeKm: Number(form.standardFreeKm),
      highValueThreshold: form.highValueThreshold,
      highValueFreeKm: Number(form.highValueFreeKm),
      smallOrderFee: form.smallOrderFee,
      smallOrderIncludedKm: Number(form.smallOrderIncludedKm),
      maxCharge: form.maxCharge.trim() === '' ? null : form.maxCharge,
    };
    try {
      const metres = Math.round(Number(tryKm) * 1000);
      if (!Number.isFinite(metres) || metres < 0) return null;
      return chargeForLeg(metres, `${Number(trySubtotal).toFixed(2)}`, config);
    } catch {
      // A half-typed figure is not an error worth shouting about — the preview
      // simply has nothing to say until the boxes make sense again.
      return null;
    }
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <label className="flex items-center justify-between gap-4">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Charge by distance</span>
            <span className="text-muted-foreground text-xs">
              Off means every area keeps its own flat charge, exactly as it does now. Turn this on
              once the warehouses are entered and stocked.
            </span>
          </span>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm((c) => ({ ...c, enabled: v }))}
          />
        </label>
      </div>

      <div className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <div>
          <h2 className="font-medium">How far, and what a block costs</h2>
          <p className="text-muted-foreground text-sm">
            Beyond whatever is free, every started block is charged in full.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Road factor"
            htmlFor="roadFactor"
            error={errors.roadFactor}
            hint="Straight line × this ≈ road distance."
          >
            <Input
              id="roadFactor"
              value={form.roadFactor}
              onChange={(e) => setForm((c) => ({ ...c, roadFactor: e.target.value }))}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
          <Field label="Block size (km)" htmlFor="blockKm" error={errors.blockKm}>
            <Input
              id="blockKm"
              value={form.blockKm}
              onChange={(e) => setForm((c) => ({ ...c, blockKm: e.target.value }))}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
          <Field label="Charge per block" htmlFor="perBlock" error={errors.perBlockCharge}>
            <Input
              id="perBlock"
              value={form.perBlockCharge}
              onChange={(e) => setForm((c) => ({ ...c, perBlockCharge: e.target.value }))}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
        </div>
      </div>

      <div className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <div>
          <h2 className="font-medium">The three bands</h2>
          <p className="text-muted-foreground text-sm">
            Judged once on the whole order, after any discount and before tax — then applied to
            every warehouse the basket comes from.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Small orders below"
            htmlFor="stdThreshold"
            error={errors.standardThreshold}
            hint="Under this, the flat fee below applies."
          >
            <Input
              id="stdThreshold"
              value={form.standardThreshold}
              onChange={(e) => setForm((c) => ({ ...c, standardThreshold: e.target.value }))}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
          <Field label="Standard free distance (km)" htmlFor="stdFree" error={errors.standardFreeKm}>
            <Input
              id="stdFree"
              value={form.standardFreeKm}
              onChange={(e) => setForm((c) => ({ ...c, standardFreeKm: e.target.value }))}
              inputMode="decimal"
              className="tabular"
            />
          </Field>

          <Field label="Small-order flat fee" htmlFor="smallFee" error={errors.smallOrderFee}>
            <Input
              id="smallFee"
              value={form.smallOrderFee}
              onChange={(e) => setForm((c) => ({ ...c, smallOrderFee: e.target.value }))}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
          <Field
            label="Distance the flat fee covers (km)"
            htmlFor="smallKm"
            error={errors.smallOrderIncludedKm}
            hint="Past this, blocks are charged on top of the fee."
          >
            <Input
              id="smallKm"
              value={form.smallOrderIncludedKm}
              onChange={(e) => setForm((c) => ({ ...c, smallOrderIncludedKm: e.target.value }))}
              inputMode="decimal"
              className="tabular"
            />
          </Field>

          <Field
            label="High-value orders above"
            htmlFor="highThreshold"
            error={errors.highValueThreshold}
          >
            <Input
              id="highThreshold"
              value={form.highValueThreshold}
              onChange={(e) => setForm((c) => ({ ...c, highValueThreshold: e.target.value }))}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
          <Field
            label="High-value free distance (km)"
            htmlFor="highFree"
            error={errors.highValueFreeKm}
          >
            <Input
              id="highFree"
              value={form.highValueFreeKm}
              onChange={(e) => setForm((c) => ({ ...c, highValueFreeKm: e.target.value }))}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
        </div>

        <Field
          label="Most a customer can be charged"
          htmlFor="maxCharge"
          error={errors.maxCharge}
          hint="Leave blank for no cap. Applies to the whole order, however many warehouses it comes from."
        >
          <Input
            id="maxCharge"
            value={form.maxCharge}
            onChange={(e) => setForm((c) => ({ ...c, maxCharge: e.target.value }))}
            inputMode="decimal"
            className="tabular sm:max-w-[220px]"
          />
        </Field>
      </div>

      <div className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <div>
          <h2 className="font-medium">Try it</h2>
          <p className="text-muted-foreground text-sm">
            One warehouse, one distance — what that leg would cost with the figures above.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Order value" htmlFor="trySubtotal">
            <Input
              id="trySubtotal"
              value={trySubtotal}
              onChange={(e) => setTrySubtotal(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              className="tabular w-[140px]"
            />
          </Field>
          <Field label="Distance (km)" htmlFor="tryKm">
            <Input
              id="tryKm"
              value={tryKm}
              onChange={(e) => setTryKm(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              className="tabular w-[120px]"
            />
          </Field>
          <div className="flex flex-col gap-1.5 pb-[2px]">
            <span className="text-muted-foreground text-sm">Delivery</span>
            <span className="tabular text-xl font-medium">
              {preview === null ? '—' : preview === '0.00' ? 'Free' : formatINR(preview)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" disabled={isSaving} onClick={save}>
          {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
          Save charges
        </Button>
      </div>
    </div>
  );
}
