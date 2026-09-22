'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatINR, type UnloadingServiceDto } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { saveUnloadingService } from '@/app/(dashboard)/delivery/actions';

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

/**
 * The unloading service offered in the cart.
 *
 * The fine print is edited as one line per row in a textarea — it renders as
 * bullets under the offer — so adding a condition is typing a line, not
 * finding an "add" button. A price change applies from the next cart re-price;
 * orders already placed keep the fee they were charged.
 */
export function UnloadingServiceForm({ initial }: { initial: UnloadingServiceDto }) {
  const router = useRouter();
  const [form, setForm] = useState({
    enabled: initial.enabled,
    nameEn: initial.nameEn,
    nameHi: initial.nameHi,
    price: initial.price,
    notesEn: initial.notesEn.join('\n'),
    notesHi: initial.notesHi.join('\n'),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  const set =
    (key: 'nameEn' | 'nameHi' | 'price' | 'notesEn' | 'notesHi') =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveUnloadingService({
        enabled: form.enabled,
        nameEn: form.nameEn,
        nameHi: form.nameHi,
        price: form.price,
        notesEn: form.notesEn.split('\n'),
        notesHi: form.notesHi.split('\n'),
      });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Unloading service saved');
      router.refresh();
    });
  }

  const previewNotes = form.notesEn.split('\n').filter((line) => line.trim() !== '');
  const validPrice = /^\d{1,8}(\.\d{1,2})?$/.test(form.price.trim());

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card flex items-center justify-between gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">Offer in the cart</h2>
          <p className="text-muted-foreground text-xs">
            Off hides it from the cart. Customers who already added it are no longer charged.
          </p>
        </div>
        <Switch
          checked={form.enabled}
          onCheckedChange={(value) => setForm((c) => ({ ...c, enabled: value }))}
          aria-label="Unloading service on or off"
        />
      </section>

      <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name" htmlFor="unload-name" error={errors.nameEn}>
            <Input id="unload-name" value={form.nameEn} onChange={set('nameEn')} />
          </Field>
          <Field label="Name (Hindi)" htmlFor="unload-name-hi" hint="Blank uses the English name.">
            <Input id="unload-name-hi" value={form.nameHi} onChange={set('nameHi')} />
          </Field>
          <Field
            label="Price per order"
            htmlFor="unload-price"
            error={errors.price}
            hint="A flat fee, added to the order total."
          >
            <Input
              id="unload-price"
              value={form.price}
              onChange={set('price')}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="What's included"
            htmlFor="unload-notes"
            error={errors.notesEn}
            hint="One point per line. Shown as bullets under the offer."
          >
            <Textarea id="unload-notes" value={form.notesEn} onChange={set('notesEn')} rows={4} />
          </Field>
          <Field
            label="What's included (Hindi)"
            htmlFor="unload-notes-hi"
            error={errors.notesHi}
            hint="Blank shows the English points."
          >
            <Textarea id="unload-notes-hi" value={form.notesHi} onChange={set('notesHi')} rows={4} />
          </Field>
        </div>
      </section>

      {/* What the customer sees, from what is typed — before saving. */}
      <section className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium">Preview in the cart</span>
        <div className="rounded-lg bg-[var(--success-bg)] p-3">
          <p className="font-semibold">Need help with unloading?</p>
          <div className="bg-card mt-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <span>{form.nameEn || 'Unloading Service'}</span>
              <span className="flex flex-col items-end gap-1">
                <span className="rounded-md border border-[var(--success)] px-4 py-1 text-sm text-[var(--success-fg)]">
                  Add
                </span>
                <span className="tabular font-semibold">
                  {validPrice ? formatINR(form.price.trim()) : '—'}
                </span>
              </span>
            </div>
            {previewNotes.length > 0 && (
              <ul className="mt-2 list-disc rounded-md bg-sky-50 py-2 pl-7 pr-3 text-sm text-sky-800">
                {previewNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <Button type="button" className="self-start" disabled={isSaving} onClick={save}>
        {isSaving ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
        Save
      </Button>
    </div>
  );
}
