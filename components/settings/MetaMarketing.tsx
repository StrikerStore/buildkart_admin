'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SendIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatINR, type MarketingEventDto, type MetaMarketingDto } from '@StrikerStore/contract';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  saveMetaMarketing,
  sendMetaTest,
  syncMetaInsights,
} from '@/app/(dashboard)/settings/marketing/actions';

function Section({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * The Conversions API's credentials.
 *
 * The secret handling is the payment screen's: the token input always renders
 * empty, blank means keep what is stored, and the placeholder carries the last
 * four characters so you can tell which token is there without it being here.
 */
export function MetaMarketingForm({ data }: { data: MetaMarketingDto }) {
  const router = useRouter();
  const [form, setForm] = useState({
    enabled: data.enabled,
    pixelId: data.pixelId,
    accessToken: '',
    clearAccessToken: false,
    testEventCode: data.testEventCode,
    adAccountId: data.adAccountId,
    insightsToken: '',
    clearInsightsToken: false,
    domainVerification: data.domainVerification,
    reportCounterOrders: data.reportCounterOrders,
    consentBanner: data.consentBanner,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isTesting, startTest] = useTransition();
  const [isSyncing, startSync] = useTransition();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = () =>
    startSave(async () => {
      setErrors({});
      setError(null);
      const result = await saveMetaMarketing(form);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setError(result.formErrors?.[0] ?? null);
        toast.error(result.formErrors?.[0] ?? 'Check the highlighted fields.');
        return;
      }
      // The typed token is stored now; holding it in state is the one place it
      // could leak back into a re-render.
      setForm((current) => ({
        ...current,
        accessToken: '',
        clearAccessToken: false,
        insightsToken: '',
        clearInsightsToken: false,
      }));
      toast.success('Saved');
      router.refresh();
    });

  const test = () =>
    startTest(async () => {
      const result = await sendMetaTest();
      if (!result.ok) {
        toast.error(result.formErrors?.[0] ?? 'The test event was not sent.');
        return;
      }
      toast.success(
        `Meta received ${result.data.eventsReceived} event. Check Events Manager → Test events.`,
      );
      router.refresh();
    });

  const sync = () =>
    startSync(async () => {
      const result = await syncMetaInsights();
      if (!result.ok) {
        toast.error(result.formErrors?.[0] ?? 'The sync failed.');
        router.refresh();
        return;
      }
      toast.success(
        `Pulled ${result.data.rows} ad-day rows (${result.data.since} to ${result.data.until}).`,
      );
      router.refresh();
    });

  return (
    <>
      <Section
        title="Meta Conversions API"
        subtitle="Reports every customer order to Meta from the server, alongside the browser pixel."
        aside={
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => set('enabled', v)}
            className="mt-1 shrink-0"
          />
        }
      >
        {!data.secretsKeyConfigured && (
          <div className="flex items-start gap-2.5 rounded-md bg-[var(--warning-bg)] px-3 py-2.5 text-xs text-[var(--warning-fg)]">
            <TriangleAlertIcon className="mt-px size-4 shrink-0" />
            <p>
              <span className="font-medium">The access token cannot be saved.</span> The server has
              no usable <code className="font-mono">SETTINGS_ENCRYPTION_KEY</code>. Storing it in
              the clear is not something this will do.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pixelId">Pixel (dataset) id</Label>
            <Input
              id="pixelId"
              inputMode="numeric"
              value={form.pixelId}
              onChange={(e) => set('pixelId', e.target.value.replace(/\D/g, ''))}
              placeholder="1793332318385090"
              className="font-mono"
              maxLength={20}
              aria-invalid={Boolean(errors.pixelId)}
            />
            <span className="text-muted-foreground text-xs">
              {errors.pixelId ??
                'Must be the same pixel as META_PIXEL_ID on the storefront, or Meta cannot pair the two copies of a sale.'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="testEventCode">Test event code</Label>
            <Input
              id="testEventCode"
              value={form.testEventCode}
              onChange={(e) => set('testEventCode', e.target.value.trim())}
              placeholder="TEST12345"
              className="font-mono"
              maxLength={32}
              aria-invalid={Boolean(errors.testEventCode)}
            />
            <span className="text-muted-foreground text-xs">
              {errors.testEventCode ??
                'From Events Manager → Test events. While set, real orders go to Test events too — clear it when you are done.'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accessToken">Access token</Label>
          <div className="flex items-center gap-2">
            <Input
              id="accessToken"
              type="password"
              autoComplete="off"
              value={form.accessToken}
              onChange={(e) => set('accessToken', e.target.value)}
              disabled={!data.secretsKeyConfigured || form.clearAccessToken}
              placeholder={
                data.accessToken.configured ? (data.accessToken.hint ?? '••••') : 'Not set'
              }
              className="font-mono"
              aria-invalid={Boolean(errors.accessToken)}
            />
            {data.accessToken.configured && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => set('clearAccessToken', !form.clearAccessToken)}
              >
                {form.clearAccessToken ? 'Keep' : <XIcon className="size-4" />}
                <span className="sr-only">
                  {form.clearAccessToken ? 'Keep' : 'Remove'} the token
                </span>
              </Button>
            )}
          </div>
          <span className="text-muted-foreground text-xs">
            {errors.accessToken ??
              (form.clearAccessToken
                ? 'Will be removed when you save.'
                : data.accessToken.configured
                  ? 'Leave blank to keep what is stored.'
                  : 'Events Manager → your pixel → Settings → Conversions API → Generate access token.')}
          </span>
        </div>

        {data.testEventCode && data.enabled && (
          <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
            {/* Easy to forget, and the cost is silent: real sales never reach the
              ad account's optimisation while it is set. */}
            Test mode is on: every order is being sent to Test events instead of your live data.
          </p>
        )}

        {error && (
          <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isSaving} onClick={save}>
            {isSaving ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isTesting || !data.accessToken.configured || !data.testEventCode}
            onClick={test}
            title={
              !data.testEventCode
                ? 'Save a test event code first'
                : 'Send one test Purchase to Meta'
            }
          >
            {isTesting ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
            Send test event
          </Button>
        </div>
      </Section>

      <Section
        title="Meta ad spend"
        subtitle="Read daily from the Insights API, so the Analytics page can show spend, ROAS and cost per customer."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adAccountId">Ad account id</Label>
            <Input
              id="adAccountId"
              value={form.adAccountId}
              onChange={(e) => set('adAccountId', e.target.value.trim())}
              placeholder="act_1234567890"
              className="font-mono"
              maxLength={30}
              aria-invalid={Boolean(errors.adAccountId)}
            />
            <span className="text-muted-foreground text-xs">
              {errors.adAccountId ?? 'Ads Manager → the account menu. With or without act_.'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="insightsToken">Insights token</Label>
            <div className="flex items-center gap-2">
              <Input
                id="insightsToken"
                type="password"
                autoComplete="off"
                value={form.insightsToken}
                onChange={(e) => set('insightsToken', e.target.value)}
                disabled={!data.secretsKeyConfigured || form.clearInsightsToken}
                placeholder={
                  data.insightsToken.configured ? (data.insightsToken.hint ?? '••••') : 'Not set'
                }
                className="font-mono"
              />
              {data.insightsToken.configured && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => set('clearInsightsToken', !form.clearInsightsToken)}
                >
                  {form.clearInsightsToken ? 'Keep' : <XIcon className="size-4" />}
                  <span className="sr-only">
                    {form.clearInsightsToken ? 'Keep' : 'Remove'} the token
                  </span>
                </Button>
              )}
            </div>
            <span className="text-muted-foreground text-xs">
              {form.clearInsightsToken
                ? 'Will be removed when you save.'
                : 'A System User token with ads_read (Business settings → System users). Blank uses the Conversions API token.'}
            </span>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          {data.insightsSync.lastError ? (
            <span className="text-[var(--critical-fg)]">
              Last sync failed: {data.insightsSync.lastError}
            </span>
          ) : data.insightsSync.lastOkAt ? (
            `Last synced ${new Date(data.insightsSync.lastOkAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })} · ${data.insightsSync.rows} ad-day rows.`
          ) : (
            'Not synced yet. Save the ad account id, then sync.'
          )}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isSaving} onClick={save}>
            {isSaving ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSyncing || !data.adAccountId}
            onClick={sync}
          >
            {isSyncing ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Sync now
          </Button>
        </div>
      </Section>

      <Section
        title="Catalog, verification and privacy"
        subtitle="What Meta needs for catalog ads, and how much of each visit it is told about."
      >
        <div className="flex flex-col gap-1.5">
          <Label>Product catalog feed</Label>
          <code className="bg-muted w-fit rounded px-2 py-1 font-mono text-xs">
            https://&lt;your storefront&gt;/feeds/meta.csv
          </code>
          <span className="text-muted-foreground text-xs">
            Commerce Manager → Catalog → Data sources → Data feed → scheduled, daily. Every item&apos;s id
            is its product handle, the same id the pixel sends, so catalog ads can match views and
            purchases to products.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="domainVerification">Domain verification code</Label>
          <Input
            id="domainVerification"
            value={form.domainVerification}
            onChange={(e) => set('domainVerification', e.target.value)}
            placeholder="abc123xyz789…"
            className="font-mono"
            maxLength={200}
            aria-invalid={Boolean(errors.domainVerification)}
          />
          <span className="text-muted-foreground text-xs">
            {errors.domainVerification ??
              'Business settings → Brand safety → Domains → Meta-tag verification. Paste the code or the whole tag; it is added to every storefront page.'}
          </span>
        </div>

        <label className="flex items-start justify-between gap-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Report counter and phone orders</span>
            <span className="text-muted-foreground text-xs">
              Sends orders you enter in the admin to Meta as offline conversions (phone call), with
              the customer&apos;s phone number hashed — so ads that make the phone ring get credit.
              Needs the Conversions API above.
            </span>
          </span>
          <Switch
            checked={form.reportCounterOrders}
            onCheckedChange={(v) => set('reportCounterOrders', v)}
            className="mt-1 shrink-0"
          />
        </label>

        <label className="flex items-start justify-between gap-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Ask visitors before Meta tracking</span>
            <span className="text-muted-foreground text-xs">
              Shows a short Allow / Don&apos;t allow banner on the storefront. The Meta Pixel sends
              nothing until a visitor allows it, and a visitor who declines is left out of the
              server-side events too. The shop&apos;s own analytics are not affected. Mention Meta in
              your privacy policy either way.
            </span>
          </span>
          <Switch
            checked={form.consentBanner}
            onCheckedChange={(v) => set('consentBanner', v)}
            className="mt-1 shrink-0"
          />
        </label>

        <Button type="button" className="self-start" disabled={isSaving} onClick={save}>
          {isSaving ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          Save
        </Button>
      </Section>
    </>
  );
}

const AD_URL_PARAMETERS =
  'utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}';

/** Last 30 days of customer orders by where they came from. */
export function AttributionSummary({ data }: { data: MetaMarketingDto['attribution'] }) {
  const share = data.orders > 0 ? Math.round((data.withSource / data.orders) * 100) : 0;

  return (
    <Section
      title="Where orders came from"
      subtitle={
        data.orders > 0
          ? `Last 30 days: ${data.orders} customer orders, ${share}% with a known source.`
          : 'No customer orders with attribution yet. Orders placed from now on are tracked.'
      }
    >
      {data.byChannel.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byChannel.map((row) => (
              <TableRow key={row.channel}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(row.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-muted-foreground text-xs">
        Credited to the last visit that had a source. For Meta ads to show up here by campaign, set
        these URL parameters on every ad in Ads Manager:{' '}
        {/* One string, so a copy never picks up a line break. */}
        <code className="font-mono break-all">{AD_URL_PARAMETERS}</code>
      </p>
    </Section>
  );
}

const STATUS_VARIANT: Record<MarketingEventDto['status'], 'secondary' | 'destructive' | 'outline'> =
  {
    SENT: 'secondary',
    FAILED: 'destructive',
    PENDING: 'outline',
    // Not sent because the shopper declined on the consent banner.
    SKIPPED: 'outline',
  };

/** The last events sent, so "is it working?" has an answer on this page. */
export function MarketingEventsLog({ events }: { events: MarketingEventDto[] }) {
  return (
    <Section
      title="Recent events"
      subtitle="The last 25 sent to Meta. Failed ones are retried every few minutes for up to a week."
    >
      {events.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing sent yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {new Date(event.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>
                  {event.eventName}
                  {event.isTest && (
                    <Badge variant="outline" className="ml-1.5">
                      Test
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{event.orderNumber ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {event.value ? formatINR(event.value) : '—'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={STATUS_VARIANT[event.status]}
                    title={event.lastError ?? undefined}
                  >
                    {event.status === 'FAILED' && event.attempts > 1
                      ? `Failed ×${event.attempts}`
                      : event.status.toLowerCase()}
                  </Badge>
                  {event.status === 'FAILED' && event.lastError && (
                    <p className="text-muted-foreground mt-1 max-w-64 text-xs">{event.lastError}</p>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
