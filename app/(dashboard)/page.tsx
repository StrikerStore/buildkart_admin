import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { AlertTriangleIcon, PackageIcon } from 'lucide-react';
import {
  analyticsWindow,
  compactINR,
  formatDayKey,
  formatINR,
  ANALYTICS_RANGES,
  ANALYTICS_RANGE_LABELS,
  ORDER_STATUS_LABELS,
  type AnalyticsRange,
  type OrderStatus,
} from '@buildkart/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { StatTile } from '@/components/dashboard/StatTile';
import { RangeFilter } from '@/components/dashboard/RangeFilter';
import { ChartCard, DataTable } from '@/components/dashboard/ChartCard';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { RankedBars } from '@/components/dashboard/RankedBars';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Home' };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const candidate = typeof raw.range === 'string' ? raw.range : '30d';
  const range: AnalyticsRange = (ANALYTICS_RANGES as readonly string[]).includes(candidate)
    ? (candidate as AnalyticsRange)
    : '30d';

  const data = await (await api()).operations.dashboard.query({ range });
  const window = analyticsWindow(range);
  const comparison = `vs previous ${window.days} days`;

  const periodLabel = ANALYTICS_RANGE_LABELS[range].toLowerCase();

  return (
    <PageContainer>
      <PageHeader
        title="Home"
        subtitle={`${formatDayKey(data.daily[0]?.day ?? '')} to today · ${data.unfulfilled} order${data.unfulfilled === 1 ? '' : 's'} still to fulfil`}
      />

      <div className="flex flex-col gap-4">
        {/* useSearchParams needs a Suspense boundary, or the whole route opts
            out of static optimisation and renders entirely on the client. */}
        <Suspense fallback={<div className="h-[34px]" />}>
          <RangeFilter range={range} />
        </Suspense>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/*
            * Each tile names what it falls back to. A bare "vs previous 30
            * days" with no figure beside it tells the reader nothing — it looks
            * like a number failed to load rather than like there was nothing to
            * compare against.
            */}
          <StatTile
            label="Revenue"
            value={formatINR(data.revenue.value)}
            change={data.revenue.change}
            comparison={comparison}
            footnote={`No revenue in the previous ${window.days} days`}
          />
          <StatTile
            label="Orders"
            value={data.orders.value}
            change={data.orders.change}
            comparison={comparison}
            footnote={`No orders in the previous ${window.days} days`}
          />
          <StatTile
            label="Average order"
            value={formatINR(data.averageOrder.value)}
            change={data.averageOrder.change}
            comparison={comparison}
            footnote="No earlier orders to compare against"
          />
          <StatTile
            label="New customers"
            value={data.newCustomers.value}
            change={data.newCustomers.change}
            comparison={comparison}
            footnote={`None joined in the previous ${window.days} days`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Revenue"
            subtitle={`Daily, ${periodLabel}`}
            headline={compactINR(data.revenue.value)}
            table={
              <DataTable
                columns={['Day', 'Revenue']}
                rows={data.daily.map((point) => [formatDayKey(point.day), formatINR(point.revenue)])}
              />
            }
          >
            <TrendChart points={data.daily} metric="revenue" color="--chart-1" />
          </ChartCard>

          <ChartCard
            title="Orders"
            subtitle={`Daily, ${periodLabel}`}
            headline={data.orders.value}
            table={
              <DataTable
                columns={['Day', 'Orders']}
                rows={data.daily.map((point) => [formatDayKey(point.day), point.orders])}
              />
            }
          >
            {/* A second hue because it is a different measure, not a second
                series — the two never share a plot or an axis. */}
            <TrendChart points={data.daily} metric="orders" color="--chart-2" />
          </ChartCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Top products"
            subtitle={`By revenue, ${periodLabel}`}
            table={
              <DataTable
                columns={['Product', 'Qty', 'Revenue']}
                rows={data.topProducts.map((p) => [p.name, p.quantity, formatINR(p.revenue)])}
              />
            }
          >
            <RankedBars
              rows={data.topProducts.map((product) => ({
                key: product.id ?? product.name,
                label: product.name,
                sublabel: `${product.quantity} sold`,
                value: Number(product.revenue),
                display: compactINR(product.revenue),
                href: product.id ? `/products/${product.id}` : undefined,
              }))}
              emptyLabel="No orders in this period."
            />
          </ChartCard>

          <ChartCard
            title="Orders by status"
            subtitle={`Where this period's orders sit now`}
            table={
              <DataTable
                columns={['Status', 'Orders', 'Value']}
                rows={data.byStatus.map((s) => [
                  ORDER_STATUS_LABELS[s.status as OrderStatus] ?? s.status,
                  s.count,
                  formatINR(s.revenue),
                ])}
              />
            }
          >
            <RankedBars
              rows={data.byStatus.map((entry) => ({
                key: entry.status,
                label: ORDER_STATUS_LABELS[entry.status as OrderStatus] ?? entry.status,
                value: entry.count,
                display: String(entry.count),
                href: `/orders?status=${entry.status}`,
              }))}
              emptyLabel="No orders in this period."
            />
          </ChartCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            title="Top categories"
            subtitle={`By revenue, ${periodLabel}`}
            table={
              <DataTable
                columns={['Category', 'Revenue']}
                rows={data.topCategories.map((c) => [c.name, formatINR(c.revenue)])}
              />
            }
          >
            <RankedBars
              rows={data.topCategories.map((category) => ({
                key: category.name,
                label: category.name,
                value: Number(category.revenue),
                display: compactINR(category.revenue),
              }))}
              emptyLabel="No orders in this period."
            />
          </ChartCard>

          <Card title="Needs restocking">
            {data.lowStock.length === 0 ? (
              <p className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-xs">
                <PackageIcon className="size-6" strokeWidth={1.5} />
                Everything is above its alert level.
              </p>
            ) : (
              <ul className="flex flex-col">
                {data.lowStock.map((row) => (
                  <li key={row.variantId} className="border-b py-1.5 last:border-b-0">
                    <Link
                      href={`/products/${row.productId}`}
                      className="hover:bg-muted/50 -mx-1.5 flex items-center gap-2 rounded px-1.5 py-1 transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{row.name}</span>
                        {row.variantLabel && (
                          <span className="text-muted-foreground block truncate text-xs">
                            {row.variantLabel}
                          </span>
                        )}
                      </span>
                      <span
                        className={cnStock(row.stockQty)}
                      >
                        {row.stockQty <= 0 && (
                          <AlertTriangleIcon className="mr-1 inline size-3.5" />
                        )}
                        {row.stockQty}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <StatTile
              label="Cash still to collect"
              value={formatINR(data.pendingCod.amount)}
              footnote={`${data.pendingCod.count} unpaid COD order${data.pendingCod.count === 1 ? '' : 's'}`}
            />
            <StatTile
              label="Orders to fulfil"
              value={String(data.unfulfilled)}
              footnote="Placed through out for delivery"
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

/** Out of stock is critical, at-threshold is a warning, anything else is plain. */
function cnStock(qty: number): string {
  const base = 'tabular shrink-0 text-right font-medium';
  if (qty <= 0) return `${base} text-[var(--critical-fg)]`;
  return `${base} text-[var(--warning-fg)]`;
}
