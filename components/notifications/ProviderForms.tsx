'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  EMAIL_PROVIDERS,
  PROVIDER_LABELS,
  SMS_PROVIDERS,
  WHATSAPP_PROVIDERS,
  type NotificationProvidersDto,
  type SecretFieldDto,
} from '@StrikerStore/contract';
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
  saveEmailProvider,
  saveSmsProvider,
  saveWhatsappProvider,
} from '@/app/(dashboard)/notifications/actions';

/**
 * Where the messages would go out from.
 *
 * The secret handling is the payment screen's, unchanged: a secret input always
 * renders empty, blank means keep what is stored, and the placeholder carries
 * the hint so you can tell which key is there without the key being here.
 */
export function ProviderForms({ providers }: { providers: NotificationProvidersDto }) {
  return (
    <div className="flex flex-col gap-4">
      {!providers.secretsKeyConfigured && (
        <div className="flex items-start gap-2.5 rounded-md bg-[var(--warning-bg)] px-3 py-2.5 text-xs text-[var(--warning-fg)]">
          <TriangleAlertIcon className="mt-px size-4 shrink-0" />
          <p>
            <span className="font-medium">Credentials cannot be saved.</span> The server
            has no usable <code className="font-mono">SETTINGS_ENCRYPTION_KEY</code> — it is
            either unset or not 32 bytes of base64url. Storing an API key in the clear is not
            something this will do. Everything else still saves.
          </p>
        </div>
      )}

      <SmsForm data={providers.sms} keyed={providers.secretsKeyConfigured} />
      <WhatsappForm data={providers.whatsapp} keyed={providers.secretsKeyConfigured} />
      <EmailForm data={providers.email} keyed={providers.secretsKeyConfigured} />

      <p className="text-muted-foreground text-xs">
        {/* Said once, plainly: the alternative is somebody entering live
            credentials and waiting for a message that never comes. */}
        Nothing is sent yet, whatever is switched on here. Connecting a provider to
        the order flow is the next piece of work.
      </p>
    </div>
  );
}

function Card({
  title,
  subtitle,
  enabled,
  onEnabled,
  children,
  onSave,
  isSaving,
  error,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  children: React.ReactNode;
  onSave: () => void;
  isSaving: boolean;
  error: string | null;
}) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabled} className="mt-1 shrink-0" />
      </div>

      {children}

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
        Save
      </Button>
    </section>
  );
}

/** A secret input: always empty, hint in the placeholder, explicit clear. */
function SecretInput({
  id,
  label,
  stored,
  value,
  clearing,
  disabled,
  onValue,
  onClear,
  hint,
}: {
  id: string;
  label: string;
  stored: SecretFieldDto;
  value: string;
  clearing: boolean;
  disabled: boolean;
  onValue: (v: string) => void;
  onClear: () => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          disabled={disabled || clearing}
          placeholder={stored.configured ? (stored.hint ?? '••••') : 'Not set'}
          className="font-mono"
        />
        {stored.configured && (
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onClear}>
            {clearing ? 'Keep' : <XIcon className="size-4" />}
            <span className="sr-only">{clearing ? 'Keep' : 'Remove'} the key</span>
          </Button>
        )}
      </div>
      <span className="text-muted-foreground text-xs">
        {clearing
          ? 'Will be removed when you save.'
          : stored.configured
            ? 'Leave blank to keep what is stored.'
            : hint}
      </span>
    </div>
  );
}

function useProviderForm<T extends object>(initial: T, save: (input: unknown) => Promise<{ ok: boolean; formErrors?: string[]; fieldErrors?: Record<string, string> }>) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, start] = useTransition();

  const set = <K extends keyof T>(key: K, value: T[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = (reset: Partial<T>) =>
    start(async () => {
      setErrors({});
      setError(null);
      const result = await save(form);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setError(result.formErrors?.[0] ?? null);
        toast.error(result.formErrors?.[0] ?? 'Check the highlighted fields.');
        return;
      }
      // Typed secrets are stored now; keeping them in state is the one place
      // they could leak back into a re-render.
      setForm((current) => ({ ...current, ...reset }));
      toast.success('Saved');
      router.refresh();
    });

  return { form, set, errors, error, isSaving, submit };
}

function SmsForm({ data, keyed }: { data: NotificationProvidersDto['sms']; keyed: boolean }) {
  const { form, set, errors, error, isSaving, submit } = useProviderForm(
    {
      enabled: data.enabled,
      provider: data.provider,
      senderId: data.senderId,
      dltEntityId: data.dltEntityId,
      apiKey: '',
      clearApiKey: false,
    },
    saveSmsProvider,
  );

  return (
    <Card
      title="SMS"
      subtitle="The one that reaches a phone with no data connection."
      enabled={form.enabled}
      onEnabled={(v) => set('enabled', v)}
      onSave={() => submit({ apiKey: '', clearApiKey: false })}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Provider</Label>
          <Select value={form.provider} onValueChange={(v) => set('provider', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SMS_PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="senderId">Sender id</Label>
          <Input
            id="senderId"
            value={form.senderId}
            onChange={(e) => set('senderId', e.target.value.toUpperCase())}
            placeholder="BLDKRT"
            className="font-mono"
            maxLength={16}
          />
          <span className="text-muted-foreground text-xs">The six letters a customer sees.</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dltEntityId">DLT entity id</Label>
          <Input
            id="dltEntityId"
            value={form.dltEntityId}
            onChange={(e) => set('dltEntityId', e.target.value)}
            className="font-mono"
          />
          {errors.dltEntityId ? (
            <span className="text-xs text-[var(--critical-fg)]">{errors.dltEntityId}</span>
          ) : (
            <span className="text-muted-foreground text-xs">
              {/* This is the one that silently loses messages, so it is stated
                  rather than left to be discovered. */}
              Indian SMS is not delivered without one.
            </span>
          )}
        </div>

        <SecretInput
          id="smsApiKey"
          label="API key"
          stored={data.apiKey}
          value={form.apiKey}
          clearing={form.clearApiKey}
          disabled={!keyed}
          onValue={(v) => set('apiKey', v)}
          onClear={() => set('clearApiKey', !form.clearApiKey)}
        />
      </div>
    </Card>
  );
}

function WhatsappForm({
  data,
  keyed,
}: {
  data: NotificationProvidersDto['whatsapp'];
  keyed: boolean;
}) {
  const { form, set, error, isSaving, submit } = useProviderForm(
    {
      enabled: data.enabled,
      provider: data.provider,
      phoneNumberId: data.phoneNumberId,
      apiToken: '',
      clearApiToken: false,
    },
    saveWhatsappProvider,
  );

  return (
    <Card
      title="WhatsApp"
      subtitle="Where most Indian customers actually read things."
      enabled={form.enabled}
      onEnabled={(v) => set('enabled', v)}
      onSave={() => submit({ apiToken: '', clearApiToken: false })}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Provider</Label>
          <Select value={form.provider} onValueChange={(v) => set('provider', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WHATSAPP_PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phoneNumberId">Phone number id</Label>
          <Input
            id="phoneNumberId"
            value={form.phoneNumberId}
            onChange={(e) => set('phoneNumberId', e.target.value)}
            className="font-mono"
          />
        </div>

        <SecretInput
          id="waToken"
          label="API token"
          stored={data.apiToken}
          value={form.apiToken}
          clearing={form.clearApiToken}
          disabled={!keyed}
          onValue={(v) => set('apiToken', v)}
          onClear={() => set('clearApiToken', !form.clearApiToken)}
        />
      </div>
    </Card>
  );
}

function EmailForm({ data, keyed }: { data: NotificationProvidersDto['email']; keyed: boolean }) {
  const { form, set, errors, error, isSaving, submit } = useProviderForm(
    {
      enabled: data.enabled,
      provider: data.provider,
      fromName: data.fromName,
      fromEmail: data.fromEmail,
      host: data.host,
      port: data.port,
      username: data.username,
      password: '',
      clearPassword: false,
    },
    saveEmailProvider,
  );

  return (
    <Card
      title="Email"
      subtitle="For invoices and anything too long for an SMS."
      enabled={form.enabled}
      onEnabled={(v) => set('enabled', v)}
      onSave={() => submit({ password: '', clearPassword: false })}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Provider</Label>
          <Select value={form.provider} onValueChange={(v) => set('provider', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fromEmail">From address</Label>
          <Input
            id="fromEmail"
            value={form.fromEmail}
            onChange={(e) => set('fromEmail', e.target.value)}
            placeholder="orders@buildkart.co"
          />
          {errors.fromEmail && (
            <span className="text-xs text-[var(--critical-fg)]">{errors.fromEmail}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fromName">From name</Label>
          <Input
            id="fromName"
            value={form.fromName}
            onChange={(e) => set('fromName', e.target.value)}
            placeholder="BuildKart"
          />
        </div>

        {form.provider === 'SMTP' && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={form.host}
                onChange={(e) => set('host', e.target.value)}
                className="font-mono"
              />
              {errors.host && (
                <span className="text-xs text-[var(--critical-fg)]">{errors.host}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                value={String(form.port)}
                onChange={(e) => set('port', Number(e.target.value.replace(/\D/g, '')) || 0)}
                inputMode="numeric"
                className="tabular"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
              />
            </div>
          </>
        )}

        <SecretInput
          id="emailPassword"
          label={form.provider === 'SMTP' ? 'Password' : 'API key'}
          stored={data.password}
          value={form.password}
          clearing={form.clearPassword}
          disabled={!keyed}
          onValue={(v) => set('password', v)}
          onClear={() => set('clearPassword', !form.clearPassword)}
        />
      </div>
    </Card>
  );
}
