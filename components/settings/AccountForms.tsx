'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword, updateProfile } from '@/app/(dashboard)/settings/account/actions';

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

export function ProfileForm({ initial }: { initial: { name: string } }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await updateProfile({ name });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Name saved');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Your name"
        htmlFor="name"
        error={errors.name}
        hint="Shown in the top bar, and against every change you make."
      >
        <Input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          className="sm:max-w-[360px]"
        />
      </Field>

      <Button
        type="button"
        className="self-start"
        disabled={isSaving || name.trim() === initial.name}
        onClick={save}
      >
        {isSaving ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : (
          <CheckIcon className="size-4" />
        )}
        Save name
      </Button>
    </div>
  );
}

const BLANK = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function PasswordForm() {
  const router = useRouter();
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    startSaving(async () => {
      const result = await changePassword(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      // Nothing here should survive a successful change — least of all in a
      // form the next person at this desk could read out of the DOM.
      setForm(BLANK);
      toast.success('Password changed. Every other device has been signed out.');
      router.refresh();
    });
  }

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form onSubmit={save} className="flex flex-col gap-3 sm:max-w-[360px]" noValidate>
      {/* Off-screen, but present: a password manager that cannot see which
          account this belongs to offers to save the wrong one. */}
      <input type="hidden" name="username" autoComplete="username" />

      <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword}>
        <Input
          id="currentPassword"
          type="password"
          value={form.currentPassword}
          onChange={set('currentPassword')}
          autoComplete="current-password"
        />
      </Field>

      <Field
        label="New password"
        htmlFor="newPassword"
        error={errors.newPassword}
        hint="At least 12 characters. Length beats punctuation — three ordinary words is a good one."
      >
        <Input
          id="newPassword"
          type="password"
          value={form.newPassword}
          onChange={set('newPassword')}
          autoComplete="new-password"
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <Input
          id="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
          autoComplete="new-password"
        />
      </Field>

      <p className="text-muted-foreground text-xs">
        Saving signs out every other device immediately. This one stays signed in.
      </p>

      <Button type="submit" className="self-start" disabled={isSaving}>
        {isSaving ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : (
          <CheckIcon className="size-4" />
        )}
        Change password
      </Button>
    </form>
  );
}
