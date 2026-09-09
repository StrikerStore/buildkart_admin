'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatINR, formatOrderNumber } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveCommerceSettings, saveStoreSettings } from '@/app/(dashboard)/settings/actions';

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

export function StoreProfileForm({
  initial,
}: {
  initial: {
    nameEn: string;
    nameHi: string;
    supportPhone: string;
    whatsappNumber: string;
    supportEmail: string;
    addressLines: string[];
    gstin: string;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...initial, address: initial.addressLines.join('\n') });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveStoreSettings({
        nameEn: form.nameEn,
        nameHi: form.nameHi,
        supportPhone: form.supportPhone,
        whatsappNumber: form.whatsappNumber,
        supportEmail: form.supportEmail,
        addressLines: form.address.split('\n'),
        gstin: form.gstin,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Store details saved');
      router.refresh();
    });
  }

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Store name" htmlFor="nameEn" error={errors.nameEn}>
          <Input id="nameEn" value={form.nameEn} onChange={set('nameEn')} />
        </Field>
        <Field label="Store name (Hindi)" htmlFor="nameHi">
          <Input id="nameHi" value={form.nameHi} onChange={set('nameHi')} placeholder="बिल्डकार्ट" />
        </Field>
        <Field label="Support phone" htmlFor="supportPhone">
          <Input id="supportPhone" value={form.supportPhone} onChange={set('supportPhone')} inputMode="tel" />
        </Field>
        <Field label="WhatsApp number" htmlFor="whatsappNumber" hint="Where order questions arrive.">
          <Input id="whatsappNumber" value={form.whatsappNumber} onChange={set('whatsappNumber')} inputMode="tel" />
        </Field>
        <Field label="Support email" htmlFor="supportEmail" error={errors.supportEmail}>
          <Input id="supportEmail" value={form.supportEmail} onChange={set('supportEmail')} />
        </Field>
        <Field
          label="GSTIN"
          htmlFor="gstin"
          error={errors.gstin}
          hint="Printed on every order slip."
        >
          <Input
            id="gstin"
            value={form.gstin}
            onChange={(e) => setForm((c) => ({ ...c, gstin: e.target.value.toUpperCase() }))}
            className="font-mono"
            placeholder="23ABCDE1234F1Z5"
          />
        </Field>
      </div>

      <Field label="Shop address" htmlFor="address" hint="One line per row. This is the invoice letterhead.">
        <Textarea id="address" value={form.address} onChange={set('address')} rows={3} />
      </Field>

      <Button type="button" className="self-start" disabled={isSaving} onClick={save}>
        {isSaving ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
        Save store details
      </Button>
    </div>
  );
}

export function CommerceSettingsForm({
  initial,
}: {
  initial: {
    bulkUnlockCutoff: string;
    orderMinimumValue: string;
    promiseHours: number;
    cutoffTime: string;
    orderNumberPrefix: string;
    orderNumberSuffix: string;
    orderNumberPadding: number;
    /** Read-only, and kept out of `form` so no field can write it back. */
    orderNumberNext: number;
  };
}) {
  const router = useRouter();
  const { orderNumberNext, ...editable } = initial;
  const [form, setForm] = useState(editable);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveCommerceSettings(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Saved');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Bulk prices unlock at"
          htmlFor="cutoff"
          error={errors.bulkUnlockCutoff}
          hint={`Carts at or above ${formatINR(form.bulkUnlockCutoff || '0')} get every line's bulk rate.`}
        >
          <Input
            id="cutoff"
            value={form.bulkUnlockCutoff}
            onChange={(e) => setForm((c) => ({ ...c, bulkUnlockCutoff: e.target.value }))}
            inputMode="decimal"
            className="tabular"
          />
        </Field>
        <Field
          label="Minimum order"
          htmlFor="minimum"
          error={errors.orderMinimumValue}
          hint="Zero means no minimum."
        >
          <Input
            id="minimum"
            value={form.orderMinimumValue}
            onChange={(e) => setForm((c) => ({ ...c, orderMinimumValue: e.target.value }))}
            inputMode="decimal"
            className="tabular"
          />
        </Field>
        <Field
          label="Delivery promise (hours)"
          htmlFor="promise"
          error={errors.promiseHours}
          hint="The headline promise. A far area can override it on its own pincode."
        >
          <Input
            id="promise"
            value={String(form.promiseHours)}
            onChange={(e) =>
              setForm((c) => ({ ...c, promiseHours: Number(e.target.value.replace(/\D/g, '')) || 0 }))
            }
            inputMode="numeric"
            className="tabular"
          />
        </Field>
        <Field
          label="Daily cutoff"
          htmlFor="cutoff-time"
          error={errors.cutoffTime}
          hint="Orders after this are promised for the next morning."
        >
          <Input
            id="cutoff-time"
            type="time"
            value={form.cutoffTime}
            onChange={(e) => setForm((c) => ({ ...c, cutoffTime: e.target.value }))}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-medium">Order numbers</h3>
          <p className="text-muted-foreground text-xs">
            {/* The counter is deliberately not editable: a number that can be
                set backwards is a number two orders can share. */}
            Changing these affects new orders only. Orders already placed keep the
            number they were given.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Prefix" htmlFor="order-prefix" error={errors.orderNumberPrefix}>
            <Input
              id="order-prefix"
              value={form.orderNumberPrefix}
              onChange={(e) => setForm((c) => ({ ...c, orderNumberPrefix: e.target.value }))}
            />
          </Field>
          <Field label="Suffix" htmlFor="order-suffix" error={errors.orderNumberSuffix}>
            <Input
              id="order-suffix"
              value={form.orderNumberSuffix}
              onChange={(e) => setForm((c) => ({ ...c, orderNumberSuffix: e.target.value }))}
              placeholder="e.g. /25"
            />
          </Field>
          <Field
            label="Pad to width"
            htmlFor="order-padding"
            error={errors.orderNumberPadding}
            hint="0 for none."
          >
            <Input
              id="order-padding"
              value={String(form.orderNumberPadding)}
              onChange={(e) =>
                setForm((c) => ({
                  ...c,
                  orderNumberPadding: Number(e.target.value.replace(/\D/g, '')) || 0,
                }))
              }
              inputMode="numeric"
              className="tabular"
            />
          </Field>
        </div>

        <p className="text-muted-foreground text-xs">
          Next order will be{' '}
          <span className="tabular text-foreground font-medium">
            {formatOrderNumber(orderNumberNext, {
              prefix: form.orderNumberPrefix,
              suffix: form.orderNumberSuffix,
              padding: form.orderNumberPadding,
            })}
          </span>
        </p>
      </div>

      <Button type="button" className="self-start" disabled={isSaving} onClick={save}>
        {isSaving ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
        Save
      </Button>
    </div>
  );
}
