import type { Metadata } from 'next';
import { formatINR } from '@StrikerStore/contract';
import { AnalyticsCard, AnalyticsShell } from '@/components/analytics/AnalyticsShell';
import { CityCsvButton, CityTable } from '@/components/analytics/CityTable';
import { CsvButton } from '@/components/analytics/CsvButton';
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
import { percent, readAnalyticsQuery } from '@/lib/analytics-query';

export const metadata: Metadata = { title: 'Acquisition · Analytics' };

/**
 * Where visitors and orders came from, by channel, source and medium, and by
 * city — and which landing pages turn visits into orders.
 *
 * Sessions by source are read from the raw session table, which keeps 90 days;
 * a period reaching further back says so rather than showing a quietly short
 * count. Cities come from the daily summary, which is kept for good.
 */
export default async function AcquisitionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('orders:read');
  const query = readAnalyticsQuery(await searchParams);
  const data = await (await api()).analytics.acquisition.query(query);
  const { period } = data;

  return (
    <AnalyticsShell active="/analytics/acquisition" query={query} period={period}>
      {!data.sessionsComplete && (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
          Sessions are kept for 90 days, so session counts by source and landing page cover only the
          last 90 days of this period. Cities, orders and revenue cover all of it.
        </p>
      )}

      <AnalyticsCard
        title="Traffic sources"
        subtitle="Source is the utm_source tag, or the referring site when there was no tag."
        actions={
          <CsvButton
            filename={`acquisition-${period.from}-to-${period.to}`}
            columns={[
              'Channel',
              'Source',
              'Medium',
              'Sessions',
              'Ordered sessions',
              'Conversion rate',
              'Orders',
              'New customers',
              'Revenue',
            ]}
            rows={data.rows.map((row) => [
              row.channelLabel,
              row.source,
              row.medium,
              row.sessions,
              row.convertedSessions,
              row.conversionRate === null ? '' : row.conversionRate.toFixed(4),
              row.orders,
              row.newCustomers,
              row.revenue,
            ])}
          />
        }
      >
        {data.rows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-xs">
            Nothing recorded in this period.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Source / medium</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Conv. rate</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">New customers</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={`${row.channel}|${row.source}|${row.medium}`}>
                  <TableCell className="whitespace-nowrap">{row.channelLabel}</TableCell>
                  <TableCell className="max-w-72">
                    <span className="block truncate font-mono text-xs">
                      {row.source ?? '(none)'}
                      {row.medium ? ` / ${row.medium}` : ''}
                    </span>
                  </TableCell>
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
        )}
      </AnalyticsCard>

      <AnalyticsCard
        title="Cities"
        subtitle="Sessions by the delivery area the shopper chose on the website; orders by the city they were delivered to. Not chosen is everyone who has not picked an area yet. Top 50 cities."
        actions={
          <CityCsvButton rows={data.cities} filename={`cities-${period.from}-to-${period.to}`} />
        }
      >
        <CityTable rows={data.cities} empty="Nothing recorded in this period." />
      </AnalyticsCard>

      <AnalyticsCard
        title="Landing pages"
        subtitle="The first page of each session, top 25 by sessions."
        actions={
          <CsvButton
            filename={`landing-pages-${period.from}-to-${period.to}`}
            columns={['Landing page', 'Sessions', 'Ordered sessions', 'Conversion rate']}
            rows={data.landingPages.map((row) => [
              row.path,
              row.sessions,
              row.convertedSessions,
              row.conversionRate === null ? '' : row.conversionRate.toFixed(4),
            ])}
          />
        }
      >
        {data.landingPages.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-xs">
            No sessions in this period.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Conv. rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.landingPages.map((row) => (
                <TableRow key={row.path}>
                  <TableCell className="max-w-96">
                    <span className="block truncate font-mono text-xs" title={row.path}>
                      {row.path}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.sessions.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.convertedSessions}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {percent(row.conversionRate, 2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AnalyticsCard>
    </AnalyticsShell>
  );
}
