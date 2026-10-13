import type { Metadata } from 'next';
import Link from 'next/link';
import { formatINR, type ProductPerformanceDto } from '@StrikerStore/contract';
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

export const metadata: Metadata = { title: 'Products · Analytics' };

/** Enough views that a low add-to-cart rate means something rather than noise. */
const ATTENTION_MIN_VIEWS = 20;

function ProductTable({ rows }: { rows: ProductPerformanceDto[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Viewers</TableHead>
          <TableHead className="text-right">Added to cart</TableHead>
          <TableHead className="text-right">View → cart</TableHead>
          <TableHead className="text-right">Units sold</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.productId}>
            <TableCell className="max-w-80">
              <Link
                href={`/products/${row.productId}`}
                className="block truncate hover:underline"
                title={row.name}
              >
                {row.name}
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.views.toLocaleString('en-IN')}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.carts.toLocaleString('en-IN')}
            </TableCell>
            <TableCell className="text-right tabular-nums">{percent(row.viewToCart)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.units.toLocaleString('en-IN')}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
            <TableCell className="text-right tabular-nums">{formatINR(row.revenue)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Product performance: who looked, who added, what sold.
 *
 * Viewers and cart adds are the Trending band's `ProductSignal` counts — one
 * per visitor per day — so they are comparable with each other but are not
 * sessions. Units and revenue are from the shop's own orders.
 */
export default async function ProductAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('orders:read');
  const query = readAnalyticsQuery(await searchParams);
  const data = await (await api()).analytics.products.query(query);
  const { period } = data;

  // Looked at a lot, rarely added: a price, a photo or a description problem.
  const attention = data.rows
    .filter((row) => row.views >= ATTENTION_MIN_VIEWS && row.viewToCart !== null)
    .sort((a, b) => (a.viewToCart ?? 0) - (b.viewToCart ?? 0))
    .slice(0, 10);

  return (
    <AnalyticsShell active="/analytics/products" query={query} period={period}>
      {attention.length > 0 && (
        <AnalyticsCard
          title="Viewed but not added"
          subtitle={`Products with at least ${ATTENTION_MIN_VIEWS} viewers and the lowest add-to-cart rate — usually the price, the photos or the description.`}
        >
          <ProductTable rows={attention} />
        </AnalyticsCard>
      )}

      <AnalyticsCard
        title="All products"
        subtitle="By revenue. Viewers and cart adds count each visitor once a day."
        actions={
          <CsvButton
            filename={`products-${period.from}-to-${period.to}`}
            columns={[
              'Product',
              'Handle',
              'Viewers',
              'Added to cart',
              'View to cart',
              'Units sold',
              'Orders',
              'Revenue',
            ]}
            rows={data.rows.map((row) => [
              row.name,
              row.handle,
              row.views,
              row.carts,
              row.viewToCart === null ? '' : row.viewToCart.toFixed(4),
              row.units,
              row.orders,
              row.revenue,
            ])}
          />
        }
      >
        {data.rows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-xs">
            No product activity in this period.
          </p>
        ) : (
          <ProductTable rows={data.rows} />
        )}
      </AnalyticsCard>
    </AnalyticsShell>
  );
}
