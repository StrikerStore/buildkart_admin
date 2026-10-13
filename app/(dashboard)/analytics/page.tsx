import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import {
  formatDayKey,
  formatINR,
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type MarketingAnalyticsDto,
} from '@StrikerStore/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { StatTile } from '@/components/dashboard/StatTile';
import { RangeFilter } from '@/components/dashboard/RangeFilter';
import { RankedBars } from '@/components/dashboard/RankedBars';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Analytics' };

const percent = (value: number | null, digits = 1) =>
  value === null ? '—' : `${(value * 100).toFixed(digits)}%`;
const times = (value: number | null) => (value === null ? '—' : `${value.toFixed(2)}×`);
const inr = (value: string | null) => (value === null ? '—' : formatINR(value));

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Shopify-style store analytics, joined to Meta ad spend.
 *
 * Sessions come from the storefront's own beacon and are summarised hourly, so
 * the funnel can be up to an hour behind; orders and revenue are live and use
 * the Home dashboard's rule (everything not cancelled), so the two agree.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('orders:read');

  const raw = await searchParams;
  const candidate = typeof raw.range === 'string' ? raw.range : '30d';
  const range: AnalyticsRange = (ANALYTICS_RANGES as readonly string[]).includes(candidate)
    ? (candidate as AnalyticsRange)
    : '30d';

  const data = await (await api()).marketing.analytics.query({ range });
  const comparison = 'vs the period before';

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        subtitle={`${formatDayKey(data.from)} to ${formatDayKey(data.to)} · sessions update hourly`}
      />

      <div className="flex flex-col gap-4">
        <Suspense fallback={<div className="h-[34px]" />}>
          <RangeFilter range={range} />
        </Suspense>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Sessions"
            value={data.sessions.value.toLocaleString('en-IN')}
            change={data.sessions.change}
            comparison={comparison}
            footnote={`${percent(data.returningRate, 0)} returning visitors`}
          />
          <StatTile
            label="Conversion rate"
            value={percent(data.conversionRate.value, 2)}
            change={data.conversionRate.change}
            comparison={comparison}
            footnote="Sessions that placed an order"
          />
          <StatTile
            label="Orders"
            value={data.orders.value.toLocaleString('en-IN')}
            change={data.orders.change}
            comparison={comparison}
          />
          <StatTile
            label="Revenue"
            value={formatINR(data.revenue.value)}
            change={data.revenue.change}
            comparison={comparison}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="Conversion funnel"
            subtitle="Sessions that got at least this far. Each bar is a share of all sessions."
          >
            <RankedBars
              rows={data.funnel.map((step) => ({
                key: step.key,
                label: step.label,
                sublabel: step.sessions.toLocaleString('en-IN'),
                value: step.sessions,
                display: percent(step.rate),
              }))}
              emptyLabel="No sessions recorded yet. They start with the storefront deploy."
            />
          </Card>

          <Card title="By device">
            {data.devices.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-xs">No sessions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Conv. rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.devices.map((row) => (
                    <TableRow key={row.device}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.sessions.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.convertedSessions}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {percent(row.conversionRate, 2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        <Card
          title="Sales by channel"
          subtitle="Where sessions and orders came from. Orders are credited to the last visit that had a source."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Conv. rate</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">New customers</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.channels.map((row) => (
                <TableRow key={row.channel}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.sessions.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {percent(row.conversionRate, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.newCustomers}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(row.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <MetaSection meta={data.meta} />
      </div>
    </PageContainer>
  );
}

function MetaSection({ meta }: { meta: MarketingAnalyticsDto['meta'] }) {
  if (!meta.configured) {
    return (
      <Card
        title="Meta ads"
        subtitle="Spend, ROAS and cost per customer from your Meta ad account."
      >
        <p className="text-sm">
          Not connected.{' '}
          <Link href="/settings/marketing" className="font-medium underline">
            Add the ad account id in Settings → Marketing
          </Link>{' '}
          to see what Meta ads cost against the orders they brought.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Meta ads"
      subtitle={
        meta.lastOkAt
          ? `Spend synced ${new Date(meta.lastOkAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}. ROAS uses your own orders; Meta's own figure is shown beside it.`
          : 'Spend has not been synced yet.'
      }
    >
      {meta.lastError && (
        <p className="flex items-start gap-2 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
          <TriangleAlertIcon className="mt-px size-4 shrink-0" />
          The last sync failed: {meta.lastError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Ad spend"
          value={formatINR(meta.spend.value)}
          change={meta.spend.change}
          comparison="vs the period before"
          upIsGood={false}
        />
        <StatTile
          label="ROAS (your orders)"
          value={times(meta.roas)}
          footnote={`${meta.orders} orders · ${formatINR(meta.revenue)} · Meta says ${times(meta.metaRoas)}`}
        />
        <StatTile label="MER" value={times(meta.mer)} footnote="All revenue ÷ all ad spend" />
        <StatTile
          label="Cost per new customer"
          value={inr(meta.cac)}
          footnote={`${meta.newCustomers} first orders from Meta ads`}
        />
      </div>

      {meta.untaggedOrders > 0 && (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
          {meta.untaggedOrders} order{meta.untaggedOrders === 1 ? '' : 's'} came from Meta ads
          without a campaign tag, so they count toward ROAS above but not toward any campaign below.
          Set the URL parameters shown in Settings → Marketing on every ad.
        </p>
      )}

      {meta.campaigns.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          No campaign spend or tagged orders in this period.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">CPM</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
              <TableHead className="text-right">Meta ROAS</TableHead>
              <TableHead className="text-right">CPA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meta.campaigns.map((row) => (
              <TableRow key={row.campaignId}>
                <TableCell className="max-w-64">
                  <span className="block truncate" title={row.campaignName}>
                    {row.campaignName}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">{row.campaignId}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(row.spend)}</TableCell>
                <TableCell className="text-right tabular-nums">{percent(row.ctr, 2)}</TableCell>
                <TableCell className="text-right tabular-nums">{inr(row.cpm)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(row.revenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{times(row.roas)}</TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {times(row.metaRoas)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{inr(row.cpa)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
