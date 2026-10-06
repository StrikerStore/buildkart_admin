'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon, PlugZapIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { GatewayHealthDto, PaymentProviderDto } from '@StrikerStore/contract';
import { PAYMENT_PROVIDER_FIELDS, hasMode } from '@StrikerStore/contract';
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
import {
  savePaymentProvider,
  testPaymentProvider,
} from '@/app/(dashboard)/settings/payments/actions';
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
  const testable = provider.provider === 'RAZORPAY' || provider.provider === 'PAYU';
  const [health, setHealth] = useState<GatewayHealthDto | null>(null);
  const [isTesting, startTesting] = useTransition();

  const [partial, setPartial] = useState(
    provider.partialCod ?? { enabled: false, percent: 10, minAdvance: '100.00', minOrderValue: '0.00' },
  );

  function test() {
    setHealth(null);
    startTesting(async () => {
      const result = await testPaymentProvider(provider.provider);
      setHealth(result.ok ? result.data : { ok: false, message: result.formErrors[0] ?? 'Test failed.' });
    });
  }

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
        ...(provider.provider === 'COD' ? { partialCod: partial } : {}),
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

      {provider.provider === 'COD' && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="cod-partial">Partial cash on delivery</Label>
              <span className="text-muted-foreground text-xs">
                The customer pays an advance online (through your top gateway) and the rest at the
                door. Works even with full COD switched off, and ignores the &ldquo;refuse above&rdquo;
                ceiling — big orders are what it is for.
              </span>
            </div>
            <Switch
              id="cod-partial"
              checked={partial.enabled}
              onCheckedChange={(enabled) => setPartial((c) => ({ ...c, enabled }))}
              className="mt-1 shrink-0"
            />
          </div>
          {partial.enabled && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Advance %" htmlFor="cod-pct" error={errors['partialCod.percent']} hint="Of the amount to pay, rounded up to the rupee.">
                <Input
                  id="cod-pct"
                  inputMode="numeric"
                  value={String(partial.percent)}
                  onChange={(e) => setPartial((c) => ({ ...c, percent: Number(e.target.value.replace(/\D/g, '')) || 0 }))}
                  className="tabular"
                />
              </Field>
              <Field label="Minimum advance" htmlFor="cod-min-adv" error={errors['partialCod.minAdvance']} hint="Never less than this.">
                <Input
                  id="cod-min-adv"
                  inputMode="decimal"
                  value={partial.minAdvance}
                  onChange={(e) => setPartial((c) => ({ ...c, minAdvance: e.target.value }))}
                  className="tabular"
                />
              </Field>
              <Field label="Orders from" htmlFor="cod-min-order" error={errors['partialCod.minOrderValue']} hint="Zero offers it on every order.">
                <Input
                  id="cod-min-order"
                  inputMode="decimal"
                  value={partial.minOrderValue}
                  onChange={(e) => setPartial((c) => ({ ...c, minOrderValue: e.target.value }))}
                  className="tabular"
                />
              </Field>
            </div>
          )}
        </div>
      )}

      {health && (
        <p
          className={cn(
            'rounded-md px-3 py-2 text-xs',
            health.ok
              ? 'bg-[var(--success-bg)] text-[var(--success-fg)]'
              : 'bg-[var(--critical-bg)] text-[var(--critical-fg)]',
          )}
        >
          {health.message}
        </p>
      )}

      {formError && (
        <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={isSaving} onClick={save}>
          {isSaving ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          Save {provider.label}
        </Button>
        {/* Tests what is *stored* — save first after changing a key. */}
        {testable && (
          <Button type="button" variant="outline" disabled={isTesting} onClick={test}>
            {isTesting ? <LoaderCircleIcon className="size-4 animate-spin" /> : <PlugZapIcon className="size-4" />}
            Test connection
          </Button>
        )}
      </div>
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
