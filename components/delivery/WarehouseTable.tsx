'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BoxesIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  WarehouseIcon,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { PinPicker } from '@/components/maps/PinPicker';
import { deleteWarehouse, saveWarehouse } from '@/app/(dashboard)/delivery/actions';
import type { AdminMap } from '@/lib/maps';
import { cn } from '@/lib/utils';

export type WarehouseRow = {
  id: string;
  name: string;
  code: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  position: number;
  isActive: boolean;
  variantCount: number;
};

const EMPTY = {
  id: undefined as string | undefined,
  name: '',
  code: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  latitude: '',
  longitude: '',
  position: '0',
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

/** The typed coordinates as a point, or null while either is blank or half-typed. */
function pickerValue(latitude: string, longitude: string): { lat: number; lng: number } | null {
  if (latitude.trim() === '' || longitude.trim() === '') return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function WarehouseTable({ rows, map }: { rows: WarehouseRow[]; map: AdminMap }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<WarehouseRow | null>(null);

  function openNew() {
    setForm({ ...EMPTY });
    setErrors({});
    setOpen(true);
  }

  function openEdit(row: WarehouseRow) {
    setForm({
      id: row.id,
      name: row.name,
      code: row.code,
      line1: row.line1,
      line2: row.line2 ?? '',
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      latitude: row.latitude,
      longitude: row.longitude,
      position: String(row.position),
      isActive: row.isActive,
    });
    setErrors({});
    setOpen(true);
  }

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveWarehouse(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success(`${result.data.code} saved`);
      setOpen(false);
      router.refresh();
    });
  }

  function remove(row: WarehouseRow) {
    startSaving(async () => {
      const result = await deleteWarehouse({ id: row.id });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not remove that warehouse.');
        return;
      }
      toast.success(`${row.code} removed`);
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={openNew}>
          <PlusIcon className="size-4" />
          Add warehouse
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <WarehouseIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <p className="font-medium">No warehouses yet</p>
          <p className="text-muted-foreground max-w-[440px]">
            {/* Without one, distance pricing has nothing to measure from and the
                cart quietly keeps using the flat per-area charge. */}
            Add the godowns you deliver from. Each one needs a location on the map, and a list of
            what it stocks, before delivery can be charged by distance.
          </p>
          <Button type="button" className="mt-1" onClick={openNew}>
            <PlusIcon className="size-4" />
            Add your first warehouse
          </Button>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium sm:flex">
            <span className="w-[90px] shrink-0">Code</span>
            <span className="min-w-0 flex-1">Warehouse</span>
            <span className="w-[150px] shrink-0 text-right">Location</span>
            <span className="w-[110px] shrink-0 text-right">Stocks</span>
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
                <span className="tabular w-[90px] shrink-0 font-medium">{row.code}</span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {row.name}
                    {!row.isActive && (
                      <span className="text-muted-foreground ml-1.5 text-xs">paused</span>
                    )}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {row.line1}, {row.city} {row.pincode}
                  </span>
                </span>

                <span className="tabular text-muted-foreground w-[150px] shrink-0 text-right text-xs">
                  {Number(row.latitude).toFixed(4)}, {Number(row.longitude).toFixed(4)}
                </span>

                <span className="w-[110px] shrink-0 text-right">
                  <Link
                    href={`/delivery/warehouses/${row.id}`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
                  >
                    <BoxesIcon className="size-3.5" />
                    <span className="tabular">
                      {row.variantCount === 0 ? 'Nothing yet' : `${row.variantCount} items`}
                    </span>
                  </Link>
                </span>

                <span className="flex w-[80px] shrink-0 justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                    aria-label={`Edit ${row.code}`}
                  >
                    <PencilIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(row)}
                    className="text-muted-foreground p-1 transition-colors hover:text-[var(--critical-fg)]"
                    aria-label={`Remove ${row.code}`}
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit warehouse' : 'Add warehouse'}</DialogTitle>
            <DialogDescription>
              Where the goods leave from. The coordinates are what the delivery charge is measured
              against — the address below is for people.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" error={errors.name}>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                placeholder="Nehru Nagar godown"
              />
            </Field>
            <Field
              label="Code"
              htmlFor="code"
              error={errors.code}
              hint="Short handle, shown on order breakdowns."
            >
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
                maxLength={32}
                className="tabular"
                placeholder="NNGR"
              />
            </Field>

            <Field label="Address" htmlFor="line1" error={errors.line1}>
              <Input
                id="line1"
                value={form.line1}
                onChange={(e) => setForm((c) => ({ ...c, line1: e.target.value }))}
                placeholder="Plot 14, Transport Nagar"
              />
            </Field>
            <Field label="Address line 2" htmlFor="line2">
              <Input
                id="line2"
                value={form.line2}
                onChange={(e) => setForm((c) => ({ ...c, line2: e.target.value }))}
                placeholder="Near the weighbridge"
              />
            </Field>

            <Field label="City" htmlFor="whCity" error={errors.city}>
              <Input
                id="whCity"
                value={form.city}
                onChange={(e) => setForm((c) => ({ ...c, city: e.target.value }))}
                placeholder="Indore"
              />
            </Field>
            <Field label="State" htmlFor="state" error={errors.state}>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => setForm((c) => ({ ...c, state: e.target.value }))}
                placeholder="Madhya Pradesh"
              />
            </Field>

            <Field label="Pincode" htmlFor="whPincode" error={errors.pincode}>
              <Input
                id="whPincode"
                value={form.pincode}
                onChange={(e) => setForm((c) => ({ ...c, pincode: e.target.value }))}
                inputMode="numeric"
                maxLength={6}
                className="tabular"
                placeholder="452001"
              />
            </Field>
            <Field
              label="Order in ties"
              htmlFor="position"
              error={errors.position}
              hint="Lowest wins when two are equally close."
            >
              <Input
                id="position"
                value={form.position}
                onChange={(e) =>
                  setForm((c) => ({ ...c, position: e.target.value.replace(/\D/g, '') }))
                }
                inputMode="numeric"
                className="tabular"
              />
            </Field>

            <Field
              label="Latitude"
              htmlFor="lat"
              error={errors.latitude}
              hint={
                map.apiKey
                  ? 'Or drag the map below.'
                  : 'From Google Maps: right-click the spot, copy.'
              }
            >
              <Input
                id="lat"
                value={form.latitude}
                onChange={(e) => setForm((c) => ({ ...c, latitude: e.target.value }))}
                inputMode="decimal"
                className="tabular"
                placeholder="22.7196"
              />
            </Field>
            <Field label="Longitude" htmlFor="lng" error={errors.longitude}>
              <Input
                id="lng"
                value={form.longitude}
                onChange={(e) => setForm((c) => ({ ...c, longitude: e.target.value }))}
                inputMode="decimal"
                className="tabular"
                placeholder="75.8577"
              />
            </Field>

            {map.apiKey && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <PinPicker
                  apiKey={map.apiKey}
                  value={pickerValue(form.latitude, form.longitude)}
                  fallback={map}
                  onChange={(latitude, longitude) =>
                    setForm((c) => ({ ...c, latitude, longitude }))
                  }
                />
                <span className="text-muted-foreground text-xs">
                  Move the map until the pin sits on the gate trucks load at — distance pricing is
                  measured from here.
                </span>
              </div>
            )}
          </div>

          <label className="flex items-center justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Serving orders</span>
              <span className="text-muted-foreground text-xs">
                Turn off to stop routing through here without losing what it stocks.
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
              {form.id ? 'Save warehouse' : 'Add warehouse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(n) => !n && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Remove {confirmDelete?.code}?</DialogTitle>
            <DialogDescription>
              What it stocks goes with it, and carts will route through whatever is next nearest.
              Past orders keep the warehouse they shipped from.
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
