'use client';

import { CheckIcon, LoaderCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

/**
 * The pieces every checkout tab repeats.
 *
 * Kept here rather than duplicated four times: the tabs are siblings and should
 * look identical, and a save button that behaves differently on one of them is
 * the kind of thing nobody reports but everybody notices.
 */

export function Card({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      {title && (
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0">
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </label>
  );
}

/** An English field with its Hindi counterpart beside it. */
export function TranslatedField({
  label,
  hint,
  en,
  hi,
  onEn,
  onHi,
  multiline,
  placeholder,
}: {
  label: string;
  hint?: string;
  en: string;
  hi: string;
  onEn: (value: string) => void;
  onHi: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const Field = multiline ? Textarea : Input;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          value={en}
          onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
            onEn(e.target.value)
          }
          placeholder={placeholder}
          {...(multiline ? { rows: 3 } : {})}
        />
        <Field
          value={hi}
          onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
            onHi(e.target.value)
          }
          placeholder="हिन्दी"
          lang="hi"
          {...(multiline ? { rows: 3 } : {})}
        />
      </div>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

export function SaveBar({
  error,
  isSaving,
  onSave,
  label,
}: {
  error: string | null;
  isSaving: boolean;
  onSave: () => void;
  label: string;
}) {
  return (
    <>
      {error && (
        <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
          {error}
        </p>
      )}
      <Button type="button" className="self-start" disabled={isSaving} onClick={onSave}>
        {isSaving ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : (
          <CheckIcon className="size-4" />
        )}
        {label}
      </Button>
    </>
  );
}
