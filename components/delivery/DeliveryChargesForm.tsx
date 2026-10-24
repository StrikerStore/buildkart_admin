'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircleIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  deliveryFeeFor,
  formatINR,
  isMoneyString,
  type DeliveryChargeRules,
  type DeliveryChargesDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveDeliveryCharges } from '@/app/(dashboard)/delivery/actions';

type SlabForm = { from: string; base: string };
type RangeForm = { upToKm: string; addition: string };

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function RowErrors({ errors, keys }: { errors: Record<string, string>; keys: string[] }) {
  return (
    <>
      {keys.map((key) =>
        errors[key] ? (
          <span key={key} className="text-xs text-[var(--critical-fg)]">
            {errors[key]}
          </span>
        ) : null,
      )}
    </>
  );
}

/** "5", "7.5" — km as the owner typed them, without trailing zeros. */
const km = (value: number) => String(Math.round(value * 1000) / 1000);

/**
 * The typed figures as rules, or null while any of them is not a number yet —
 * the preview has nothing to say until the boxes make sense.
 */
function toRules(form: {
  roadFactor: string;
  slabs: SlabForm[];
  ranges: RangeForm[];
  freeAbove: string;
}): DeliveryChargeRules | null {
  const money = (value: string) => (isMoneyString(value.trim()) ? value.trim() : null);
  const slabs = form.slabs.map((slab) => ({ from: money(slab.from), base: money(slab.base) }));
  const ranges = form.ranges.map((range) => ({
    upToKm: Number(range.upToKm),
    addition: money(range.addition),
  }));
  const freeAbove = form.freeAbove.trim() === '' ? null : money(form.freeAbove);
  if (slabs.some((slab) => slab.from === null || slab.base === null)) return null;
  if (ranges.some((range) => !(range.upToKm > 0) || range.addition === null)) return null;
  if (form.freeAbove.trim() !== '' && freeAbove === null) return null;
  return {
    roadFactor: Number(form.roadFactor) || 1,
    slabs: slabs as DeliveryChargeRules['slabs'],
    ranges: ranges as DeliveryChargeRules['ranges'],
    freeAbove,
  };
}

/**
 * The delivery charge for flat-priced products: a base by what the whole cart
 * is worth, plus the charge of every distance range the trip passes through,
 * and nothing at or above the free threshold. Distance-priced products are not
 * charged delivery at all — their price carries it.
 */
export function DeliveryChargesForm({
  initial,
  activeWarehouses,
}: {
  initial: DeliveryChargesDto;
  activeWarehouses: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    roadFactor: String(initial.roadFactor),
    slabs: initial.slabs.map((slab) => ({ from: slab.from, base: slab.base })),
    ranges: initial.ranges.map((range) => ({ upToKm: km(range.upToKm), addition: range.addition })),
    freeAbove: initial.freeAbove ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  /* The preview's own inputs — a cart total and a distance to try. */
  const [tryTotal, setTryTotal] = useState('3000');
  const [tryKm, setTryKm] = useState('7');

  const setSlab = (index: number, value: Partial<SlabForm>) =>
    setForm((c) => ({ ...c, slabs: c.slabs.map((s, i) => (i === index ? { ...s, ...value } : s)) }));
  const setRange = (index: number, value: Partial<RangeForm>) =>
    setForm((c) => ({ ...c, ranges: c.ranges.map((r, i) => (i === index ? { ...r, ...value } : r)) }));

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveDeliveryCharges(form);
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
   * The preview runs the real rule, not a copy of it: `deliveryFeeFor` is the
   * same pure function the cart and the order writer call, exported through the
   * contract. A second implementation for the preview would eventually disagree
   * with the one that charges money, and the preview is where that would be
   * believed.
   */
  const rules = toRules(form);
  const preview = (() => {
    if (!rules) return null;
    const total = Number(tryTotal);
    const metres = Math.round(Number(tryKm) * 1000);
    if (!Number.isFinite(total) || total < 0 || !Number.isFinite(metres) || metres < 0) return null;
    try {
      return deliveryFeeFor({ cartTotal: total.toFixed(2), metres, rules });
    } catch {
      return null;
    }
  })();

  // What happens past the last range, said in words under the table.
  const sortedRanges = rules ? [...rules.ranges].sort((a, b) => a.upToKm - b.upToKm) : [];
  const lastRange = sortedRanges[sortedRanges.length - 1];
  const lastWidth =
    lastRange && sortedRanges.length > 1
      ? lastRange.upToKm - sortedRanges[sortedRanges.length - 2]!.upToKm
      : lastRange?.upToKm;

  return (
    <div className="flex flex-col gap-4">
      {activeWarehouses === 0 && (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-fg)]">
          No warehouse is active, so every distance is measured as 0 km — deliveries pay the first
          range only, and distance-priced products their price at the gate. Add a warehouse under
          Delivery → Warehouses.
        </p>
      )}

      <Section
        title="By cart total"
        subtitle="The base charge, from the whole cart's value after any coupon and before tax — distance-priced products included. Each slab runs from its amount up to the next one's."
      >
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-medium">
            <span>Cart total from (₹)</span>
            <span>Up to</span>
            <span>Base charge (₹)</span>
            <span className="w-8" />
          </div>
          {form.slabs.map((slab, i) => {
            const next = form.slabs[i + 1]?.from;
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                  <Input
                    aria-label={`Slab ${i + 1} from`}
                    value={slab.from}
                    onChange={(e) => setSlab(i, { from: e.target.value })}
                    inputMode="decimal"
                    className="tabular"
                    placeholder={i === 0 ? '0' : '1000'}
                  />
                  <span className="text-muted-foreground tabular text-sm">
                    {next && isMoneyString(next.trim()) ? `below ${formatINR(next.trim())}` : 'and above'}
                  </span>
                  <Input
                    aria-label={`Slab ${i + 1} base charge`}
                    value={slab.base}
                    onChange={(e) => setSlab(i, { base: e.target.value })}
                    inputMode="decimal"
                    className="tabular"
                    placeholder="300"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove slab ${i + 1}`}
                    disabled={form.slabs.length === 1}
                    onClick={() => setForm((c) => ({ ...c, slabs: c.slabs.filter((_, j) => j !== i) }))}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
                <RowErrors errors={errors} keys={[`slabs.${i}.from`, `slabs.${i}.base`]} />
              </div>
            );
          })}
          <RowErrors errors={errors} keys={['slabs']} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setForm((c) => ({ ...c, slabs: [...c.slabs, { from: '', base: '' }] }))}
          >
            <PlusIcon className="size-4" />
            Add slab
          </Button>
        </div>
      </Section>

      <Section
        title="By distance"
        subtitle="Added on top of the base: every range the trip passes through adds its charge. Measured from the farthest warehouse the order's flat-priced items come from."
      >
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-medium">
            <span>From</span>
            <span>Up to (km)</span>
            <span>Adds (₹)</span>
            <span className="w-8" />
          </div>
          {form.ranges.map((range, i) => {
            const previous = i === 0 ? '0' : form.ranges[i - 1]!.upToKm;
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                  <span className="text-muted-foreground tabular text-sm">
                    {previous.trim() === '' ? '—' : `${previous} km`}
                  </span>
                  <Input
                    aria-label={`Range ${i + 1} up to km`}
                    value={range.upToKm}
                    onChange={(e) => setRange(i, { upToKm: e.target.value })}
                    inputMode="decimal"
                    className="tabular"
                    placeholder="5"
                  />
                  <Input
                    aria-label={`Range ${i + 1} charge`}
                    value={range.addition}
                    onChange={(e) => setRange(i, { addition: e.target.value })}
                    inputMode="decimal"
                    className="tabular"
                    placeholder="30"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove range ${i + 1}`}
                    disabled={form.ranges.length === 1}
                    onClick={() =>
                      setForm((c) => ({ ...c, ranges: c.ranges.filter((_, j) => j !== i) }))
                    }
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
                <RowErrors errors={errors} keys={[`ranges.${i}.upToKm`, `ranges.${i}.addition`]} />
              </div>
            );
          })}
          <RowErrors errors={errors} keys={['ranges']} />
          {lastRange && lastWidth !== undefined && (
            <p className="text-muted-foreground text-xs">
              Beyond {km(lastRange.upToKm)} km: +{formatINR(lastRange.addition)} for every further{' '}
              {km(lastWidth)} km started.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setForm((c) => ({ ...c, ranges: [...c.ranges, { upToKm: '', addition: '' }] }))
            }
          >
            <PlusIcon className="size-4" />
            Add range
          </Button>
        </div>
      </Section>

      <Section
        title="Free delivery, and distance"
        subtitle="At or above the free threshold, delivery costs nothing however far it goes."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="freeAbove">Free delivery from (₹)</Label>
            <Input
              id="freeAbove"
              value={form.freeAbove}
              onChange={(e) => setForm((c) => ({ ...c, freeAbove: e.target.value }))}
              inputMode="decimal"
              className="tabular"
              placeholder="No free threshold"
            />
            {errors.freeAbove ? (
              <span className="text-xs text-[var(--critical-fg)]">{errors.freeAbove}</span>
            ) : (
              <span className="text-muted-foreground text-xs">Leave blank for none.</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="roadFactor">Road factor</Label>
            <Input
              id="roadFactor"
              value={form.roadFactor}
              onChange={(e) => setForm((c) => ({ ...c, roadFactor: e.target.value }))}
              inputMode="decimal"
              className="tabular"
            />
            {errors.roadFactor ? (
              <span className="text-xs text-[var(--critical-fg)]">{errors.roadFactor}</span>
            ) : (
              <span className="text-muted-foreground text-xs">
                Straight line × this ≈ road distance. Used for distance-priced products too.
              </span>
            )}
          </div>
        </div>
      </Section>

      <Section title="Try it" subtitle="A cart total and a distance — what delivery would cost.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tryTotal">Cart total</Label>
            <Input
              id="tryTotal"
              value={tryTotal}
              onChange={(e) => setTryTotal(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              className="tabular w-[140px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tryKm">Distance (km)</Label>
            <Input
              id="tryKm"
              value={tryKm}
              onChange={(e) => setTryKm(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              className="tabular w-[120px]"
            />
          </div>
          <div className="flex flex-col gap-1.5 pb-[2px]">
            <span className="text-muted-foreground text-sm">Delivery</span>
            <span className="tabular text-xl font-medium">
              {preview === null ? '—' : preview.charge === '0.00' ? 'Free' : formatINR(preview.charge)}
            </span>
          </div>
        </div>
        {preview && !preview.free && (
          <p className="text-muted-foreground tabular text-xs">
            {formatINR(preview.slabBase)} base
            {preview.parts.map((part) => (
              <span key={part.fromKm}>
                {' + '}
                {part.times > 1 ? `${part.times} × ` : ''}
                {formatINR(part.addition)} ({km(part.fromKm)}–{km(part.toKm)} km)
              </span>
            ))}
          </p>
        )}
        {preview?.free && (
          <p className="text-muted-foreground text-xs">Over the free threshold, so nothing at any distance.</p>
        )}
      </Section>

      <div className="flex justify-end">
        <Button type="button" disabled={isSaving} onClick={save}>
          {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
          Save charges
        </Button>
      </div>
    </div>
  );
}
