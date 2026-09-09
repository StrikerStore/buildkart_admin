import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, ShoppingBagIcon } from 'lucide-react';
import { formatINR, orderListQuerySchema } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrderListTable } from '@/components/orders/OrderListTable';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Orders' };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const parsed = orderListQuerySchema.safeParse({
    q: typeof raw.q === 'string' ? raw.q : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    paymentMethod: typeof raw.paymentMethod === 'string' ? raw.paymentMethod : undefined,
    paymentStatus: typeof raw.paymentStatus === 'string' ? raw.paymentStatus : undefined,
    gateway: typeof raw.gateway === 'string' ? raw.gateway : undefined,
    range: typeof raw.range === 'string' ? raw.range : undefined,
    sort: typeof raw.sort === 'string' ? raw.sort : undefined,
    page: typeof raw.page === 'string' ? raw.page : undefined,
  });
  // A hand-edited URL should show the default list, not an error page.
  const query = parsed.success ? parsed.data : orderListQuerySchema.parse({});

  const { orders, totalPages, counts, unfilteredTotal, openCount, revenue } =
    await (await api()).orders.list.query(query);

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (query.q) next.set('q', query.q);
    if (query.status !== 'ALL') next.set('status', query.status);
    if (query.paymentMethod !== 'ALL') next.set('paymentMethod', query.paymentMethod);
    if (query.paymentStatus !== 'ALL') next.set('paymentStatus', query.paymentStatus);
    if (query.gateway !== 'ALL') next.set('gateway', query.gateway);
    if (query.range !== 'all') next.set('range', query.range);
    if (query.sort !== 'newest') next.set('sort', query.sort);
    if (page > 1) next.set('page', String(page));
    return `/orders${next.toString() ? `?${next}` : ''}`;
  };

  const isFiltered =
    Boolean(query.q) ||
    query.status !== 'ALL' ||
    query.paymentMethod !== 'ALL' ||
    query.paymentStatus !== 'ALL' ||
    query.gateway !== 'ALL' ||
    query.range !== 'all';

  return (
    <PageContainer>
      <PageHeader
        title="Orders"
        subtitle={
          unfilteredTotal > 0
            ? `${openCount} open · ${formatINR(
                revenue,
              )} across ${unfilteredTotal} order${unfilteredTotal === 1 ? '' : 's'}`
            : undefined
        }
        actions={
          <Button asChild>
            <Link href="/orders/new">
              <PlusIcon className="size-4" />
              Create order
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        {/* useSearchParams needs a Suspense boundary, or the whole route opts
            out of static optimisation and renders entirely on the client. */}
        <Suspense fallback={<div className="h-[100px]" />}>
          <OrderFilters counts={counts} />
        </Suspense>

        {orders.length === 0 ? (
          <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
            <ShoppingBagIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                {isFiltered ? 'No orders match these filters' : 'No orders yet'}
              </p>
              <p className="text-muted-foreground max-w-[400px]">
                {isFiltered
                  ? 'Try a wider date range or clear a filter.'
                  : 'Orders placed on the storefront appear here the moment they land — or take one by phone.'}
              </p>
            </div>
            {!isFiltered && (
              <Button asChild className="mt-1">
                <Link href="/orders/new">
                  <PlusIcon className="size-4" />
                  Create an order
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <OrderListTable orders={orders} />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Page {query.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" disabled={query.page <= 1}>
                <Link href={pageHref(query.page - 1)} aria-disabled={query.page <= 1}>
                  <ChevronLeftIcon className="size-4" />
                  Previous
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" disabled={query.page >= totalPages}>
                <Link href={pageHref(query.page + 1)}>
                  Next
                  <ChevronRightIcon className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
