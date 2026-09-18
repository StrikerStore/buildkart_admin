'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLinkIcon, MapPinIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  MAP_PROVIDERS,
  MAP_PROVIDER_HINTS,
  MAP_PROVIDER_LABELS,
  providerNeedsKey,
  type CheckoutLocationDto,
  type MapProvider,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveCheckoutLocation } from '@/app/(dashboard)/checkout/actions';
import { Card, SaveBar, Toggle, TranslatedField } from './shared';
import { cn } from '@/lib/utils';

/**
 * The map-and-pin address picker, as configured rather than as rendered.
 *
 * The picker itself belongs to the storefront, which does not exist yet. What
 * is settled here is everything it will need: which map to load, with which
 * key, where to open, and what to do when the pin lands somewhere the shop
 * does not deliver to.
 */
export function LocationForm({
  initial,
  secretsKeyConfigured,
}: {
  initial: CheckoutLocationDto;
  secretsKeyConfigured: boolean;
}) {
  const router = useRouter();

  const [form, setForm] = useState({
    ...initial,
    /** Typed this session only; blank means keep what is stored. */
    serverKey: '',
    clearServerKey: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const needsKey = providerNeedsKey(form.provider);

  function save() {
    setErrors({});
    setFormError(null);
    startSaving(async () => {
      const result = await saveCheckoutLocation(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      // The typed key is stored now; holding it in React state is the one place
      // it could leak back into a re-render.
      setForm((current) => ({ ...current, serverKey: '', clearServerKey: false }));
      toast.success('Location picker saved');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Pick on a map"
        subtitle="The map-and-pin screen quick-commerce apps open with, instead of typing an address."
      >
        <Toggle
          label="Use a location picker"
          hint="The customer drops a pin; the pincode and delivery charge follow from it."
          checked={form.enabled}
          onChange={(v) => set('enabled', v)}
        />
      </Card>

      {form.enabled && (
        <>
          <Card title="Map">
            <div className="grid gap-2 sm:grid-cols-3">
              {MAP_PROVIDERS.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => set('provider', provider as MapProvider)}
                  aria-pressed={form.provider === provider}
                  className={cn(
                    'flex flex-col gap-1 rounded-md border p-3 text-left transition-colors',
                    form.provider === provider
                      ? 'border-[var(--nav)] bg-[var(--nav)]/5'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <span className="font-medium">{MAP_PROVIDER_LABELS[provider]}</span>
                  <span className="text-muted-foreground text-xs">
                    {MAP_PROVIDER_HINTS[provider]}
                  </span>
                </button>
              ))}
            </div>

            {needsKey && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="browserKey">Map key</Label>
                  <Input
                    id="browserKey"
                    value={form.browserKey}
                    onChange={(e) => set('browserKey', e.target.value)}
                    className="font-mono"
                    placeholder="AIza…"
                  />
                  {errors.browserKey ? (
                    <span className="text-xs text-[var(--critical-fg)]">{errors.browserKey}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {/* Said plainly because it looks like a secret and is not:
                          somebody will otherwise try to hide it and wonder why
                          the map stops loading. */}
                      Shown in full because it has to be — a map key travels in the
                      page. Restrict it to your storefront domain at{' '}
                      {MAP_PROVIDER_LABELS[form.provider]} instead.
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="serverKey">Geocoding key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="serverKey"
                      type="password"
                      autoComplete="off"
                      value={form.serverKey}
                      onChange={(e) => set('serverKey', e.target.value)}
                      disabled={!secretsKeyConfigured || form.clearServerKey}
                      placeholder={
                        form.serverGeocodeKey.configured
                          ? (form.serverGeocodeKey.hint ?? '••••')
                          : 'Not set'
                      }
                      className="font-mono"
                    />
                    {form.serverGeocodeKey.configured && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => set('clearServerKey', !form.clearServerKey)}
                      >
                        {form.clearServerKey ? 'Keep' : <XIcon className="size-4" />}
                        <span className="sr-only">
                          {form.clearServerKey ? 'Keep' : 'Remove'} the geocoding key
                        </span>
                      </Button>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {form.clearServerKey
                      ? 'Will be removed when you save.'
                      : form.serverGeocodeKey.configured
                        ? 'Leave blank to keep what is stored.'
                        : 'Used server-side to turn a pin into an address. This one is a real secret and is encrypted.'}
                  </span>
                </div>

                {!secretsKeyConfigured && (
                  <p className="flex items-start gap-2 rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
                    <TriangleAlertIcon className="mt-px size-4 shrink-0" />
                    The server has no usable{' '}
                    <code className="font-mono">SETTINGS_ENCRYPTION_KEY</code> — unset, or not 32
                    bytes of base64url — so the geocoding key cannot be saved. Everything else here
                    still saves.
                  </p>
                )}
              </>
            )}
          </Card>

          <Card
            title="Where the map opens"
            subtitle="Before the customer's own location is known — set it to your delivery area."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  value={String(form.defaultLat)}
                  onChange={(e) => set('defaultLat', Number(e.target.value) || 0)}
                  inputMode="decimal"
                  className="tabular"
                />
                {errors.defaultLat && (
                  <span className="text-xs text-[var(--critical-fg)]">{errors.defaultLat}</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  value={String(form.defaultLng)}
                  onChange={(e) => set('defaultLng', Number(e.target.value) || 0)}
                  inputMode="decimal"
                  className="tabular"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="zoom">Zoom</Label>
                <Input
                  id="zoom"
                  value={String(form.defaultZoom)}
                  onChange={(e) => set('defaultZoom', Number(e.target.value.replace(/\D/g, '')) || 1)}
                  inputMode="numeric"
                  className="tabular"
                />
                <span className="text-muted-foreground text-xs">1 world, 15 street.</span>
              </div>
            </div>

            <a
              href={`https://www.google.com/maps/@${form.defaultLat},${form.defaultLng},${form.defaultZoom}z`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-xs font-medium hover:underline"
            >
              <MapPinIcon className="size-3.5" />
              See where that is
              <ExternalLinkIcon className="size-3" />
            </a>
          </Card>

          <Card title="Rules">
            <Toggle
              label="Make them move the pin"
              hint="Stops an order being placed against a rough guess from the phone's GPS."
              checked={form.requirePinDrop}
              onChange={(v) => set('requirePinDrop', v)}
            />
            <Toggle
              label="Allow typing an address instead"
              hint="The way out when GPS is refused, or the map will not load."
              checked={form.allowManualAddress}
              onChange={(v) => set('allowManualAddress', v)}
            />
            <Toggle
              label="Only accept pins inside your delivery areas"
              hint="Checked against the pincodes under Delivery."
              checked={form.restrictToServiceable}
              onChange={(v) => set('restrictToServiceable', v)}
            />

            {!form.requirePinDrop && !form.allowManualAddress && (
              <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
                With no pin required and no typing allowed, there is no way to give
                an address at all.
              </p>
            )}
          </Card>

          <Card title="Wording">
            <TranslatedField
              label="Search box"
              placeholder="Search for your area"
              en={form.searchPlaceholderEn}
              hi={form.searchPlaceholderHi}
              onEn={(v) => set('searchPlaceholderEn', v)}
              onHi={(v) => set('searchPlaceholderHi', v)}
            />
            <TranslatedField
              label="Confirm button"
              placeholder="Deliver here"
              en={form.confirmLabelEn}
              hi={form.confirmLabelHi}
              onEn={(v) => set('confirmLabelEn', v)}
              onHi={(v) => set('confirmLabelHi', v)}
            />
            <TranslatedField
              label="Outside the delivery area"
              hint="Shown when the pin lands on a pincode you do not serve."
              placeholder="We do not deliver here yet — tell us and we will let you know."
              multiline
              en={form.outOfAreaMessageEn}
              hi={form.outOfAreaMessageHi}
              onEn={(v) => set('outOfAreaMessageEn', v)}
              onHi={(v) => set('outOfAreaMessageHi', v)}
            />
          </Card>
        </>
      )}

      <SaveBar error={formError} isSaving={isSaving} onSave={save} label="Save location picker" />
    </div>
  );
}
