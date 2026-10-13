import type { Metadata } from 'next';
import { formatINR } from '@StrikerStore/contract';
import { StatTile } from '@/components/dashboard/StatTile';
import { AnalyticsCard, AnalyticsShell } from '@/components/analytics/AnalyticsShell';
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

export const metadata: Metadata = { title: 'Customers · Analytics' };

const MONTH = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});
const monthLabel = (key: string) => MONTH.format(new Date(`${key}-01T00:00:00Z`));

/**
 * Who buys, and whether they come back.
 *
 * The cohort grid is the one place colour carries a number: a single hue,
 * light to dark with the share, and the percentage printed in every cell so
 * the colour is never the only way to read it.
 */
export default async function CustomerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('orders:read');
  const query = readAnalyticsQuery(await searchParams);
  const data = await (await api()).analytics.customers.query(query);
  const { period } = data;
  const months = data.cohorts[0]?.retention.length ?? 0;

  return (
    <AnalyticsShell active="/analytics/customers" query={query} period={period}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Customers who ordered"
          value={data.customers.toLocaleString('en-IN')}
          footnote={`${data.newCustomers} new · ${data.returningCustomers} returning`}
        />
        <StatTile
          label="Revenue from new customers"
          value={formatINR(data.newRevenue)}
          footnote="Their first ever order"
        />
        <StatTile
          label="Revenue from returning customers"
          value={formatINR(data.returningRevenue)}
          footnote="Every order after the first"
        />
        <StatTile
          label="Repeat rate"
          value={percent(data.repeatRate, 0)}
          footnote="Of this period's customers, share with 2+ orders ever"
        />
      </div>

      <AnalyticsCard
        title="Monthly cohorts"
        subtitle="Customers grouped by the month of their first order, and the share who ordered again in each month after. Not affected by the period filter."
        actions={
          <CsvButton
            filename="customer-cohorts"
            columns={[
              'First order month',
              'Customers',
              ...Array.from({ length: months }, (_, i) => `Month ${i}`),
            ]}
            rows={data.cohorts.map((row) => [
              row.month,
              row.size,
              ...row.retention.map((value) => (value === null ? '' : value.toFixed(4))),
            ])}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5 text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="px-2 py-1 text-left font-medium">First order</th>
                <th className="px-2 py-1 text-right font-medium">Customers</th>
                {Array.from({ length: months }, (_, i) => (
                  <th key={i} className="px-2 py-1 text-center font-medium">
                    {i === 0 ? 'Month 0' : `+${i}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((row) => (
                <tr key={row.month}>
                  <td className="px-2 py-1 whitespace-nowrap">{monthLabel(row.month)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{row.size}</td>
                  {row.retention.map((value, i) =>
                    value === null ? (
                      <td key={i} />
                    ) : (
                      <td
                        key={i}
                        className="rounded px-2 py-1 text-center tabular-nums"
                        style={{
                          // One hue, light → dark with the share. The ink stays
                          // the text token; dark cells switch to the inverse.
                          background: `color-mix(in oklab, var(--chart-1) ${Math.round(8 + value * 80)}%, var(--card))`,
                          color: value > 0.45 ? 'var(--card)' : undefined,
                        }}
                        title={`${monthLabel(row.month)} cohort, month ${i}: ${percent(value)}`}
                      >
                        {row.size === 0 ? '—' : percent(value, 0)}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AnalyticsCard>

      <AnalyticsCard
        title="Customer value by first channel"
        subtitle="Customers whose first order has a recorded source, and everything they have spent since. Not affected by the period filter."
        actions={
          <CsvButton
            filename="customer-value-by-channel"
            columns={['First channel', 'Customers', 'Orders per customer', 'Revenue per customer']}
            rows={data.ltvByChannel.map((row) => [
              row.label,
              row.customers,
              row.ordersPerCustomer.toFixed(2),
              row.revenuePerCustomer,
            ])}
          />
        }
      >
        {data.ltvByChannel.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-xs">
            No attributed first orders yet — this fills in as customers who arrived after
            attribution began place orders.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>First channel</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="text-right">Orders each</TableHead>
                <TableHead className="text-right">Revenue each</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ltvByChannel.map((row) => (
                <TableRow key={row.channel}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.customers}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.ordersPerCustomer.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(row.revenuePerCustomer)}
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
