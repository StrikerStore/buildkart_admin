import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from 'lucide-react';
import {
  customerListQuerySchema,
  formatINR,
  formatStoreDateTimeShort,
} from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Customers' };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const parsed = customerListQuerySchema.safeParse({
    q: typeof raw.q === 'string' ? raw.q : undefined,
    filter: typeof raw.filter === 'string' ? raw.filter : undefined,
    sort: typeof raw.sort === 'string' ? raw.sort : undefined,
    page: typeof raw.page === 'string' ? raw.page : undefined,
  });
  const query = parsed.success ? parsed.data : customerListQuerySchema.parse({});

  const { customers, totalPages, lifetimeSpend, customerCount } =
    await (await api()).orders.customerList.query(query);

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (query.q) next.set('q', query.q);
    if (query.filter !== 'all') next.set('filter', query.filter);
    if (query.sort !== 'recent') next.set('sort', query.sort);
    if (page > 1) next.set('page', String(page));
    return `/customers${next.toString() ? `?${next}` : ''}`;
  };

  const isFiltered = Boolean(query.q) || query.filter !== 'all';

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        subtitle={
          customerCount > 0
            ? `${customerCount} customer${customerCount === 1 ? '' : 's'} · ${formatINR(
                lifetimeSpend,
              )} lifetime`
            : undefined
        }
      />

      <div className="flex flex-col gap-4">
        {/* useSearchParams needs a Suspense boundary, or the whole route opts
            out of static optimisation and renders entirely on the client. */}
        <Suspense fallback={<div className="h-[84px]" />}>
          <CustomerFilters />
        </Suspense>

        {customers.length === 0 ? (
          <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
            <UsersIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
            <p className="font-medium">
              {isFiltered ? 'Nobody matches these filters' : 'No customers yet'}
            </p>
            <p className="text-muted-foreground max-w-[420px]">
              {isFiltered
                ? 'Try clearing a filter or searching for something else.'
                : 'A customer is created the first time an order is placed under their phone number.'}
            </p>
          </div>
        ) : (
          <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
            <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium md:flex">
              <span className="min-w-0 flex-1">Customer</span>
              <span className="w-[150px] shrink-0">Last order</span>
              <span className="w-[80px] shrink-0 text-right">Orders</span>
              <span className="w-[110px] shrink-0 text-right">Spend</span>
            </div>

            <ul>
              {customers.map((customer) => (
                <li key={customer.id} className="border-b last:border-b-0">
                  <Link
                    href={`/customers/${customer.id}`}
                    className="hover:bg-muted/40 flex flex-col gap-1 px-3 py-2.5 transition-colors md:flex-row md:items-center md:gap-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{customer.name ?? 'Unnamed'}</span>
                        {customer.isBlocked && (
                          <span className="shrink-0 rounded-full bg-[var(--critical-bg)] px-2 py-0.5 text-xs font-medium text-[var(--critical-fg)]">
                            Blocked
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {customer.phone}
                        {customer.email && ` · ${customer.email}`}
                      </span>
                    </span>

                    <span className="text-muted-foreground shrink-0 text-xs md:w-[150px]">
                      {customer.lastOrderAt
                        ? formatStoreDateTimeShort(customer.lastOrderAt)
                        : 'Never ordered'}
                    </span>

                    <span
                      className={cn(
                        'tabular shrink-0 text-right text-xs md:w-[80px]',
                        customer.totalOrders >= 2 && 'text-[var(--success-fg)]',
                      )}
                    >
                      {customer.totalOrders}
                    </span>

                    <span className="tabular shrink-0 text-right font-medium md:w-[110px]">
                      {formatINR(customer.totalSpend)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Page {query.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" disabled={query.page <= 1}>
                <Link href={pageHref(query.page - 1)}>
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
