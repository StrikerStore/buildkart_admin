'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CheckoutConfigDto } from '@buildkart/contract';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveCheckoutContent } from '@/app/(dashboard)/checkout/actions';
import { Card, SaveBar, TranslatedField } from './shared';

/** Everything the checkout says, in both languages. */
export function ContentForm({ initial }: { initial: CheckoutConfigDto['content'] }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function save() {
    setErrors({});
    setFormError(null);
    startSaving(async () => {
      const result = await saveCheckoutContent(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Wording saved');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Checkout page">
        <TranslatedField
          label="Headline"
          hint="Blank shows nothing — the form starts straight away."
          placeholder="Almost done"
          en={form.headlineEn}
          hi={form.headlineHi}
          onEn={(v) => set('headlineEn', v)}
          onHi={(v) => set('headlineHi', v)}
        />
        <TranslatedField
          label="Terms text"
          hint="Shown next to the pay button."
          placeholder="By placing this order you agree to our terms."
          multiline
          en={form.termsTextEn}
          hi={form.termsTextHi}
          onEn={(v) => set('termsTextEn', v)}
          onHi={(v) => set('termsTextHi', v)}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="termsUrl">Terms link</Label>
          <Input
            id="termsUrl"
            value={form.termsUrl}
            onChange={(e) => set('termsUrl', e.target.value)}
            placeholder="/pages/terms-and-conditions"
            className="font-mono"
          />
          {errors.termsUrl ? (
            <span className="text-xs text-[var(--critical-fg)]">{errors.termsUrl}</span>
          ) : (
            <span className="text-muted-foreground text-xs">
              Point this at the terms page you wrote under Website, Pages.
            </span>
          )}
        </div>
      </Card>

      <Card title="After the order" subtitle="The page a customer lands on once they have paid.">
        <TranslatedField
          label="Title"
          placeholder="Thank you — your order is in"
          en={form.thankYouTitleEn}
          hi={form.thankYouTitleHi}
          onEn={(v) => set('thankYouTitleEn', v)}
          onHi={(v) => set('thankYouTitleHi', v)}
        />
        <TranslatedField
          label="Message"
          hint="A good place to say when it will arrive and who will call."
          multiline
          en={form.thankYouBodyEn}
          hi={form.thankYouBodyHi}
          onEn={(v) => set('thankYouBodyEn', v)}
          onHi={(v) => set('thankYouBodyHi', v)}
        />
        <TranslatedField
          label="Support note"
          hint="Shown small, under the message."
          placeholder="Questions? WhatsApp us."
          en={form.supportNoteEn}
          hi={form.supportNoteHi}
          onEn={(v) => set('supportNoteEn', v)}
          onHi={(v) => set('supportNoteHi', v)}
        />
      </Card>

      <SaveBar error={formError} isSaving={isSaving} onSave={save} label="Save wording" />
    </div>
  );
}
