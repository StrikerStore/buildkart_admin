'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { PaymentProviderDto } from '@buildkart/contract';
import { PAYMENT_PROVIDER_FIELDS, hasMode } from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { savePaymentProvider } from '@/app/(dashboard)/settings/payments/actions';
import { cn } from '@/lib/utils';

/**
 * One provider's card.
 *
 * The rule the whole screen turns on: **a secret input always renders empty.**
 * The stored value is never sent to the browser, so there is nothing to
 * pre-fill, and a blank field on save means "keep what you have". The
 * placeholder carries the hint so the person can tell which key is stored
 * without the key being here.
 */
export function PaymentProviderForm({
  provider,
  secretsKeyConfigured,
}: {
  provider: PaymentProviderDto;
  secretsKeyConfigured: boolean;
}) {
  const router = useRouter();
  const fields = PAYMENT_PROVIDER_FIELDS[provider.provider];
  const takesMode = hasMode(provider.provider);

  const [enabled, setEnabled] = useState(provider.enabled);
  const [mode, setMode] = useState(provider.mode);
  const [displayName, setDisplayName] = useState(provider.displayName);
  const [maxOrderValue, setMaxOrderValue] = useState(provider.maxOrderValue);
  const [publicFields, setPublicFields] = useState(provider.publicFields);
  /** Only what has been typed this session. Never seeded from the server. */
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [clearSecrets, setClearSecrets] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function save() {
    setErrors({});
    setFormError(null);
    startSaving(async () => {
      const result = await savePaymentProvider({
        provider: provider.provider,
        enabled,
        mode,
        displayName,
        displayOrder: provider.displayOrder,
        maxOrderValue,
        publicFields,
        secrets,
        clearSecrets,
      });

      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }

      // Wipe the typed secrets: they are stored now, and holding them in a
      // React state that survives a refresh is the one place they could leak
      // back into a re-render.
      setSecrets({});
      setClearSecrets([]);
      toast.success(`${provider.label} saved`);
      router.refresh();
    });
  }

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{provider.label}</h2>
            {takesMode && enabled && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  mode === 'LIVE'
                    ? 'bg-[var(--success-bg)] text-[var(--success-fg)]'
                    : 'bg-neutral-bg text-neutral-fg',
                )}
              >
                {mode === 'LIVE' ? 'Live' : 'Test'}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{provider.hint}</p>
        </div>

        <Switch checked={enabled} onCheckedChange={setEnabled} className="mt-1 shrink-0" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Name shown at checkout"
          htmlFor={`${provider.provider}-name`}
          hint={`Blank shows "${provider.label}".`}
        >
          <Input
            id={`${provider.provider}-name`}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={provider.label}
          />
        </Field>

        {takesMode && (
          <Field
            label="Mode"
            hint="Test uses the gateway's sandbox. Switch to live only with live keys."
          >
            <Select value={mode} onValueChange={(v) => setMode(v as 'TEST' | 'LIVE')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEST">Test</SelectItem>
                <SelectItem value="LIVE">Live</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {provider.provider === 'COD' && (
          <Field
            label="Refuse above"
            htmlFor="cod-max"
            error={errors.maxOrderValue}
            hint="Zero means no ceiling."
          >
            <Input
              id="cod-max"
              value={maxOrderValue}
              onChange={(e) => setMaxOrderValue(e.target.value)}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
        )}

        {fields.map((field) => {
          const id = `${provider.provider}-${field.key}`;

          if (!field.secret) {
            return (
              <Field
                key={field.key}
                label={field.label}
                htmlFor={id}
                hint={field.hint}
                error={errors[`publicFields.${field.key}`]}
              >
                <Input
                  id={id}
                  value={publicFields[field.key] ?? ''}
                  onChange={(e) =>
                    setPublicFields((c) => ({ ...c, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="font-mono"
                />
              </Field>
            );
          }

          const stored = provider.secrets[field.key];
          const willClear = clearSecrets.includes(field.key);

          return (
            <Field
              key={field.key}
              label={field.label}
              htmlFor={id}
              hint={
                willClear
                  ? 'Will be removed when you save.'
                  : (stored?.configured
                      ? 'Leave blank to keep what is stored.'
                      : field.hint)
              }
              error={errors[`secrets.${field.key}`]}
            >
              <div className="flex items-center gap-2">
                <Input
                  id={id}
                  type="password"
                  autoComplete="off"
                  value={secrets[field.key] ?? ''}
                  onChange={(e) => setSecrets((c) => ({ ...c, [field.key]: e.target.value }))}
                  disabled={!secretsKeyConfigured || willClear}
                  placeholder={stored?.configured ? (stored.hint ?? '••••') : 'Not set'}
                  className="font-mono"
                />
                {stored?.configured && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      setClearSecrets((c) =>
                        willClear ? c.filter((k) => k !== field.key) : [...c, field.key],
                      )
                    }
                  >
                    {willClear ? 'Keep' : <XIcon className="size-4" />}
                    <span className="sr-only">
                      {willClear ? 'Keep' : 'Remove'} {field.label}
                    </span>
                  </Button>
                )}
              </div>
            </Field>
          );
        })}
      </div>

      {formError && (
        <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
          {formError}
        </p>
      )}

      <Button type="button" className="self-start" disabled={isSaving} onClick={save}>
        {isSaving ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : (
          <CheckIcon className="size-4" />
        )}
        Save {provider.label}
      </Button>
    </section>
  );
}

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
