import type { Metadata } from 'next';
import Link from 'next/link';
import { TriangleAlertIcon } from 'lucide-react';
import { formatINR, type MarketingAnalyticsDto } from '@StrikerStore/contract';
import { StatTile } from '@/components/dashboard/StatTile';
import { RankedBars } from '@/components/dashboard/RankedBars';
import { AnalyticsCard, AnalyticsShell } from '@/components/analytics/AnalyticsShell';
import { CsvButton } from '@/components/analytics/CsvButton';
import { SeriesChart } from '@/components/analytics/SeriesChart';
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
import { analyticsQueryString, percent, readAnalyticsQuery, times } from '@/lib/analytics-query';

export const metadata: Metadata = { title: 'Analytics' };

const inr = (value: string | null) => (value === null ? '—' : formatINR(value));

/**
 * Shopify-style store analytics: the overview.
 *
 * Sessions come from the storefront's own beacon and are summarised hourly, so
 * they can be up to an hour behind; orders and revenue are live and use the
 * Home dashboard's rule (everything not cancelled), so the two pages agree.
 */
export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('orders:read');
  const query = readAnalyticsQuery(await searchParams);
  const data = await (await api()).analytics.overview.query(query);
  const comparison = 'vs the period before';

  const period = { range: data.range, from: data.from, to: data.to, days: data.daily.length };

  return (
    <AnalyticsShell active="/analytics" query={query} period={period} note="sessions update hourly">
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

      {/* Two charts, not one with two axes: sessions and conversion rate share
          the days but not a scale. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsCard title="Sessions per day">
          <SeriesChart
            points={data.daily.map((point) => ({ day: point.day, value: point.sessions }))}
            format="count"
            unit="session"
            color="--chart-2"
          />
        </AnalyticsCard>
        <AnalyticsCard
          title="Conversion rate per day"
          subtitle="Sessions that placed an order, by the day the session started."
        >
          <SeriesChart
            points={data.daily.map((point) => ({
              day: point.day,
              value: point.sessions > 0 ? point.convertedSessions / point.sessions : 0,
            }))}
            format="percent"
            color="--chart-1"
          />
        </AnalyticsCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsCard
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
        </AnalyticsCard>

        <AnalyticsCard title="By device">
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
        </AnalyticsCard>
      </div>

      <AnalyticsCard
        title="Sales by channel"
        subtitle={
          <>
            Orders are credited to the last visit that had a source.{' '}
            <Link
              href={`/analytics/acquisition${analyticsQueryString(query)}`}
              className="underline"
            >
              Break down by source
            </Link>
          </>
        }
        actions={
          <CsvButton
            filename={`channels-${data.from}-to-${data.to}`}
            columns={[
              'Channel',
              'Sessions',
              'Conversion rate',
              'Orders',
              'New customers',
              'Revenue',
            ]}
            rows={data.channels.map((row) => [
              row.label,
              row.sessions,
              row.conversionRate === null ? '' : row.conversionRate.toFixed(4),
              row.orders,
              row.newCustomers,
              row.revenue,
            ])}
          />
        }
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
                <TableCell className="text-right tabular-nums">{formatINR(row.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AnalyticsCard>

      <MetaSummary meta={data.meta} suffix={analyticsQueryString(query)} />
    </AnalyticsShell>
  );
}

function MetaSummary({ meta, suffix }: { meta: MarketingAnalyticsDto['meta']; suffix: string }) {
  if (!meta.configured) {
    return (
      <AnalyticsCard
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
      </AnalyticsCard>
    );
  }

  return (
    <AnalyticsCard
      title="Meta ads"
      subtitle={
        <>
          ROAS uses your own orders; Meta&apos;s figure is shown beside it.{' '}
          <Link href={`/analytics/marketing${suffix}`} className="underline">
            Campaigns, ad sets and ads
          </Link>
        </>
      }
    >
      {meta.lastError && (
        <p className="flex items-start gap-2 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
          <TriangleAlertIcon className="mt-px size-4 shrink-0" />
          The last spend sync failed: {meta.lastError}
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
    </AnalyticsCard>
  );
}
