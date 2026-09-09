import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { formatINR, formatStoreDate, formatStoreDateTimeShort } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/OrderStatusBadge';
import { CustomerDetailForm } from '@/components/customers/CustomerDetailForm';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const label = await (await api()).orders.customerLabel.query({ id });
  return { title: label ?? 'Customer' };
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      {title && <h2 className="font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="tabular text-lg font-semibold">{value}</span>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const customer = await (await api()).orders.customerDetail.query({ id });
  if (!customer) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={customer.name ?? customer.phone}
        backHref="/customers"
        backLabel="Customers"
        badge={
          customer.isBlocked ? (
            <span className="rounded-full bg-[var(--critical-bg)] px-2 py-0.5 text-xs font-medium text-[var(--critical-fg)]">
              Blocked
            </span>
          ) : undefined
        }
        subtitle={`Customer since ${formatStoreDate(customer.createdAt)}`}
        actions={
          !customer.isBlocked && (
            <Button asChild>
              <Link href="/orders/new">
                <PlusIcon className="size-4" />
                New order
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Orders" value={String(customer.totalOrders)} />
              <Stat label="Lifetime spend" value={formatINR(customer.totalSpend)} />
              <Stat label="Average order" value={formatINR(customer.averageOrderValue)} />
            </div>
          </Card>

          <Card title={`Orders${customer.orders.length > 0 ? ` (${customer.liveOrderCount})` : ''}`}>
            {customer.orders.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-xs">
                No orders yet.
              </p>
            ) : (
              <ul className="flex flex-col">
                {customer.orders.map((order) => (
                  <li key={order.id} className="border-b last:border-b-0">
                    <Link
                      href={`/orders/${order.id}`}
                      className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded px-2 py-2 transition-colors"
                    >
                      <span className="w-[92px] shrink-0 font-medium">{order.orderNumber}</span>
                      <span className="text-muted-foreground w-[130px] shrink-0 text-xs">
                        {formatStoreDateTimeShort(order.placedAt)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <OrderStatusBadge status={order.status} />
                      </span>
                      <span className="hidden shrink-0 sm:block">
                        <PaymentStatusBadge status={order.paymentStatus} />
                      </span>
                      <span className="text-muted-foreground tabular hidden w-[56px] shrink-0 text-right text-xs sm:block">
                        {order.itemCount}
                      </span>
                      <span className="tabular w-[92px] shrink-0 text-right font-medium">
                        {formatINR(order.grandTotal)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Addresses (${customer.addresses.length})`}>
            {customer.addresses.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-xs">
                No saved addresses.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {customer.addresses.map((saved) => (
                  <li key={saved.id} className="flex flex-col gap-0.5 border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{saved.line1}</span>
                      {saved.isDefault && (
                        <span className="bg-neutral-bg text-neutral-fg rounded-full px-1.5 py-0.5 text-[11px]">
                          Default
                        </span>
                      )}
                    </span>
                    {saved.line2 && <span className="text-muted-foreground text-xs">{saved.line2}</span>}
                    {saved.landmark && (
                      <span className="text-muted-foreground text-xs">Near {saved.landmark}</span>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {saved.city}, {saved.state} {saved.pincode}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Details">
            {/* The phone is not editable here: it is the identity, and changing
                it would silently move someone else's history onto this person. */}
            <CustomerDetailForm
              customerId={customer.id}
              phone={customer.phone}
              name={customer.name}
              email={customer.email}
              locale={customer.locale === 'hi' ? 'hi' : 'en'}
              notes={customer.notes}
              isBlocked={customer.isBlocked}
            />
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
