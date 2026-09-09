'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircleIcon, MapPinIcon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatINR } from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deletePincode, savePincode } from '@/app/(dashboard)/delivery/actions';
import { cn } from '@/lib/utils';

export type PincodeRow = {
  id: string;
  pincode: string;
  areaNameEn: string;
  areaNameHi: string | null;
  city: string;
  deliveryCharge: string;
  freeDeliveryAbove: string | null;
  promiseHours: number;
  cutoffTime: string | null;
  isActive: boolean;
};

const EMPTY = {
  id: undefined as string | undefined,
  pincode: '',
  areaNameEn: '',
  areaNameHi: '',
  city: '',
  deliveryCharge: '0',
  freeDeliveryAbove: '',
  promiseHours: '4',
  cutoffTime: '',
  isActive: true,
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

export function PincodeTable({ rows }: { rows: PincodeRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<PincodeRow | null>(null);

  function openNew() {
    setForm({ ...EMPTY });
    setErrors({});
    setOpen(true);
  }

  function openEdit(row: PincodeRow) {
    setForm({
      id: row.id,
      pincode: row.pincode,
      areaNameEn: row.areaNameEn,
      areaNameHi: row.areaNameHi ?? '',
      city: row.city,
      deliveryCharge: row.deliveryCharge,
      freeDeliveryAbove: row.freeDeliveryAbove ?? '',
      promiseHours: String(row.promiseHours),
      cutoffTime: row.cutoffTime ?? '',
      isActive: row.isActive,
    });
    setErrors({});
    setOpen(true);
  }

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await savePincode(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success(`${result.data.pincode} saved`);
      setOpen(false);
      router.refresh();
    });
  }

  function remove(row: PincodeRow) {
    startSaving(async () => {
      const result = await deletePincode({ id: row.id });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not remove that area.');
        return;
      }
      toast.success(`${row.pincode} removed`);
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={openNew}>
          <PlusIcon className="size-4" />
          Add area
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <MapPinIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <p className="font-medium">No delivery areas yet</p>
          <p className="text-muted-foreground max-w-[420px]">
            {/* Until one exists the storefront cannot tell a customer whether it
                delivers to them, and the order form has no charge to prefill. */}
            Add the pincodes you deliver to. Each one carries its own charge and promise.
          </p>
          <Button type="button" className="mt-1" onClick={openNew}>
            <PlusIcon className="size-4" />
            Add your first area
          </Button>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium sm:flex">
            <span className="w-[76px] shrink-0">Pincode</span>
            <span className="min-w-0 flex-1">Area</span>
            <span className="w-[100px] shrink-0 text-right">Delivery</span>
            <span className="w-[110px] shrink-0 text-right">Free above</span>
            <span className="w-[86px] shrink-0 text-right">Promise</span>
            <span className="w-[80px] shrink-0" />
          </div>

          <ul>
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 border-b px-3 py-2.5 last:border-b-0',
                  !row.isActive && 'opacity-55',
                )}
              >
                <span className="tabular w-[76px] shrink-0 font-medium">{row.pincode}</span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {row.areaNameEn}
                    {!row.isActive && (
                      <span className="text-muted-foreground ml-1.5 text-xs">paused</span>
                    )}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {row.city}
                    {row.areaNameHi && ` · ${row.areaNameHi}`}
                  </span>
                </span>

                <span className="tabular w-[100px] shrink-0 text-right">
                  {row.deliveryCharge === '0.00' ? 'Free' : formatINR(row.deliveryCharge)}
                </span>

                <span className="tabular text-muted-foreground w-[110px] shrink-0 text-right text-xs">
                  {row.freeDeliveryAbove ? formatINR(row.freeDeliveryAbove) : '—'}
                </span>

                <span className="tabular text-muted-foreground w-[86px] shrink-0 text-right text-xs">
                  {row.promiseHours}h
                  {row.cutoffTime && <span className="block">till {row.cutoffTime}</span>}
                </span>

                <span className="flex w-[80px] shrink-0 justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                    aria-label={`Edit ${row.pincode}`}
                  >
                    <PencilIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(row)}
                    className="text-muted-foreground p-1 transition-colors hover:text-[var(--critical-fg)]"
                    aria-label={`Remove ${row.pincode}`}
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit delivery area' : 'Add delivery area'}</DialogTitle>
            <DialogDescription>
              What it costs to deliver here, and how quickly it is promised.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pincode" htmlFor="pincode" error={errors.pincode}>
              <Input
                id="pincode"
                value={form.pincode}
                onChange={(e) => setForm((c) => ({ ...c, pincode: e.target.value }))}
                inputMode="numeric"
                maxLength={6}
                className="tabular"
                placeholder="452001"
              />
            </Field>
            <Field label="City" htmlFor="city" error={errors.city}>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm((c) => ({ ...c, city: e.target.value }))}
                placeholder="Indore"
              />
            </Field>
            <Field label="Area name" htmlFor="areaEn" error={errors.areaNameEn}>
              <Input
                id="areaEn"
                value={form.areaNameEn}
                onChange={(e) => setForm((c) => ({ ...c, areaNameEn: e.target.value }))}
                placeholder="Nehru Nagar"
              />
            </Field>
            <Field label="Area name (Hindi)" htmlFor="areaHi">
              <Input
                id="areaHi"
                value={form.areaNameHi}
                onChange={(e) => setForm((c) => ({ ...c, areaNameHi: e.target.value }))}
                placeholder="नेहरू नगर"
              />
            </Field>
            <Field label="Delivery charge" htmlFor="charge" error={errors.deliveryCharge}>
              <Input
                id="charge"
                value={form.deliveryCharge}
                onChange={(e) => setForm((c) => ({ ...c, deliveryCharge: e.target.value }))}
                inputMode="decimal"
                className="tabular"
              />
            </Field>
            <Field
              label="Free delivery above"
              htmlFor="free"
              error={errors.freeDeliveryAbove}
              hint="Leave blank for none."
            >
              <Input
                id="free"
                value={form.freeDeliveryAbove}
                onChange={(e) => setForm((c) => ({ ...c, freeDeliveryAbove: e.target.value }))}
                inputMode="decimal"
                className="tabular"
              />
            </Field>
            <Field
              label="Promise (hours)"
              htmlFor="hours"
              error={errors.promiseHours}
              hint="A far suburb may honestly be six."
            >
              <Input
                id="hours"
                value={form.promiseHours}
                onChange={(e) =>
                  setForm((c) => ({ ...c, promiseHours: e.target.value.replace(/\D/g, '') }))
                }
                inputMode="numeric"
                className="tabular"
              />
            </Field>
            <Field
              label="Cutoff time"
              htmlFor="cutoff"
              error={errors.cutoffTime}
              hint="Orders after this deliver next morning."
            >
              <Input
                id="cutoff"
                type="time"
                value={form.cutoffTime}
                onChange={(e) => setForm((c) => ({ ...c, cutoffTime: e.target.value }))}
              />
            </Field>
          </div>

          <label className="flex items-center justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Delivering here</span>
              <span className="text-muted-foreground text-xs">
                Turn off to pause the area without losing its settings.
              </span>
            </span>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((c) => ({ ...c, isActive: v }))}
            />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSaving} onClick={save}>
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              {form.id ? 'Save area' : 'Add area'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(n) => !n && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Remove {confirmDelete?.pincode}?</DialogTitle>
            <DialogDescription>
              The storefront will tell customers here that you do not deliver. Past orders are
              unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(null)}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving}
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
