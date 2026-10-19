import type { Metadata } from 'next';
import Link from 'next/link';
import { TriangleAlertIcon } from 'lucide-react';
import { formatINR, type AdNodeDto, STORE_TIME_ZONE } from '@StrikerStore/contract';
import { StatTile } from '@/components/dashboard/StatTile';
import { AnalyticsCard, AnalyticsShell } from '@/components/analytics/AnalyticsShell';
import { AdTree } from '@/components/analytics/AdTree';
import { CityCsvButton, CityTable } from '@/components/analytics/CityTable';
import { CsvButton } from '@/components/analytics/CsvButton';
import { SeriesChart } from '@/components/analytics/SeriesChart';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';
import { percent, readAnalyticsQuery, times } from '@/lib/analytics-query';

export const metadata: Metadata = { title: 'Meta ads · Analytics' };

const inr = (value: string | null) => (value === null ? '—' : formatINR(value));

/** Every campaign, ad set and ad as flat CSV rows, parents first. */
function flatten(nodes: AdNodeDto[], path: string[] = []): Array<Array<string | number>> {
  const level = ['Campaign', 'Ad set', 'Ad'][path.length] ?? 'Ad';
  return nodes.flatMap((node) => [
    [
      level,
      [...path, node.name].join(' › '),
      node.id,
      node.spend,
      node.impressions,
      node.linkClicks,
      node.ctr === null ? '' : node.ctr.toFixed(4),
      node.cpm ?? '',
      node.orders,
      node.revenue,
      node.roas === null ? '' : node.roas.toFixed(2),
      node.metaPurchases,
      node.metaPurchaseValue,
      node.metaRoas === null ? '' : node.metaRoas.toFixed(2),
      node.cpa ?? '',
    ],
    ...flatten(node.children, [...path, node.name]),
  ]);
}

/**
 * Meta ads against the shop's own orders: spend and attributed revenue per
 * day, campaign → ad set → ad, and ad traffic and orders by city.
 */
export default async function MarketingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('orders:read');
  const query = readAnalyticsQuery(await searchParams);
  const data = await (await api()).analytics.marketing.query(query);
  const { period, totals } = data;

  const note = data.lastOkAt
    ? `spend synced ${new Date(data.lastOkAt).toLocaleString('en-IN', {
        timeZone: STORE_TIME_ZONE,
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : undefined;

  return (
    <AnalyticsShell active="/analytics/marketing" query={query} period={period} note={note}>
      {!data.configured && (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
          No ad account connected, so there is no spend.{' '}
          <Link href="/settings/marketing" className="font-medium underline">
            Add it in Settings → Marketing
          </Link>
          . Orders from Meta ads still show below.
        </p>
      )}
      {data.lastError && (
        <p className="flex items-start gap-2 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
          <TriangleAlertIcon className="mt-px size-4 shrink-0" />
          The last spend sync failed: {data.lastError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Ad spend"
          value={formatINR(totals.spend)}
          footnote={`CPM ${inr(totals.cpm)} · CTR ${percent(totals.ctr, 2)}`}
        />
        <StatTile
          label="Orders from Meta ads"
          value={totals.orders.toLocaleString('en-IN')}
          footnote={`${formatINR(totals.revenue)} · Meta claims ${totals.metaPurchases}`}
        />
        <StatTile
          label="ROAS (your orders)"
          value={times(totals.roas)}
          footnote={`Meta says ${times(totals.metaRoas)}`}
        />
        <StatTile
          label="Cost per order"
          value={inr(totals.cpa)}
          footnote="Spend ÷ your orders from Meta"
        />
      </div>

      {/* Two charts with one axis each, not spend and revenue on twin axes. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsCard title="Spend per day">
          <SeriesChart
            points={data.daily.map((point) => ({ day: point.day, value: Number(point.spend) }))}
            format="money"
            color="--chart-2"
          />
        </AnalyticsCard>
        <AnalyticsCard
          title="Revenue from Meta ads per day"
          subtitle="Your own orders credited to paid social."
        >
          <SeriesChart
            points={data.daily.map((point) => ({ day: point.day, value: Number(point.revenue) }))}
            format="money"
            color="--chart-1"
          />
        </AnalyticsCard>
      </div>

      {data.untaggedOrders > 0 && (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
          {data.untaggedOrders} order{data.untaggedOrders === 1 ? '' : 's'} came from Meta ads
          without a campaign tag, so they count in the totals above but not under any campaign. Set
          the URL parameters shown in Settings → Marketing on every ad.
        </p>
      )}

      <AnalyticsCard
        title="Campaigns, ad sets and ads"
        subtitle="Open a row to see what is inside it. ROAS uses your own orders; Meta's figure is greyed beside it."
        actions={
          <CsvButton
            filename={`meta-ads-${period.from}-to-${period.to}`}
            columns={[
              'Level',
              'Name',
              'Id',
              'Spend',
              'Impressions',
              'Link clicks',
              'CTR',
              'CPM',
              'Orders',
              'Revenue',
              'ROAS',
              'Meta purchases',
              'Meta purchase value',
              'Meta ROAS',
              'CPA',
            ]}
            rows={flatten(data.campaigns)}
          />
        }
      >
        {data.campaigns.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-xs">
            No spend or tagged orders in this period.
          </p>
        ) : (
          <AdTree campaigns={data.campaigns} />
        )}
      </AnalyticsCard>

      <AnalyticsCard
        title="Meta ads by city"
        subtitle="Sessions from Meta ads by the delivery area the shopper chose; orders from Meta ads by the city they were delivered to. Meta only reports spend down to state, so spend is not split by city."
        actions={
          <CityCsvButton
            rows={data.cities}
            filename={`meta-ads-cities-${period.from}-to-${period.to}`}
          />
        }
      >
        <CityTable rows={data.cities} empty="No sessions or orders from Meta ads in this period." />
      </AnalyticsCard>
    </AnalyticsShell>
  );
}
