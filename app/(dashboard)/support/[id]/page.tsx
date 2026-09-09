import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PhoneIcon } from 'lucide-react';
import {
  formatINR,
  formatStoreDate,
  formatStoreDateTimeShort,
  supportTopicLabel,
} from '@buildkart/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/OrderStatusBadge';
import { SupportThread } from '@/components/support/SupportThread';
import { TicketStatusButton } from '@/components/support/TicketStatusButton';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const thread = await (await api()).support.thread.query({ ticketId: id });
  return { title: thread ? `${thread.ticketNumber} · Support` : 'Support' };
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      {title && <h2 className="font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

/**
 * One conversation, with everything needed to answer it beside it.
 *
 * The right column is the whole reason this screen exists rather than a chat
 * widget: "where is my cement" is answerable in one glance only if the order is
 * on the same page as the question. Three queries, run together — the thread,
 * the context, and the saved replies — because they always appear together.
 */
export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('support:read');
  const { id } = await params;
  const client = await api();

  const [thread, context, cannedReplies] = await Promise.all([
    client.support.thread.query({ ticketId: id }),
    client.support.context.query({ ticketId: id }),
    client.support.cannedReplies.query(),
  ]);
  if (!thread || !context) notFound();

  const { customer, order } = context;

  return (
    <PageContainer>
      <PageHeader
        title={customer.name ?? customer.phone}
        backHref="/support"
        backLabel="Support"
        badge={
          <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs font-medium">
            {thread.ticketNumber}
          </span>
        }
        subtitle={`${supportTopicLabel(thread.topic, 'en')} · started ${formatStoreDate(
          thread.createdAt,
        )}`}
        actions={<TicketStatusButton ticketId={thread.id} status={thread.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <SupportThread ticket={thread} cannedReplies={cannedReplies} />
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Customer">
            <div className="flex flex-col gap-2">
              <Row label="Phone">
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-1.5 font-medium hover:underline"
                >
                  <PhoneIcon className="size-3.5" />
                  {customer.phone}
                </a>
              </Row>
              <Row label="Orders">
                <span className="tabular font-medium">{customer.totalOrders}</span>
              </Row>
              <Row label="Lifetime spend">
                <span className="tabular font-medium">{formatINR(customer.totalSpend)}</span>
              </Row>
              <Row label="Language">{customer.locale === 'hi' ? 'Hindi' : 'English'}</Row>
              {customer.isBlocked && (
                <Row label="Status">
                  <span className="rounded-full bg-[var(--critical-bg)] px-2 py-0.5 text-xs font-medium text-[var(--critical-fg)]">
                    Blocked
                  </span>
                </Row>
              )}
            </div>

            {customer.notes && (
              <p className="text-muted-foreground bg-muted/60 rounded p-2 text-xs whitespace-pre-wrap">
                {customer.notes}
              </p>
            )}

            <Link
              href={`/customers/${customer.id}`}
              className="text-xs font-medium underline-offset-2 hover:underline"
            >
              Open customer record
            </Link>
          </Card>

          {order ? (
            <Card title={`Order ${order.orderNumber}`}>
              <div className="flex flex-wrap gap-2">
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>

              <div className="flex flex-col gap-2">
                <Row label="Placed">{formatStoreDateTimeShort(order.placedAt)}</Row>
                <Row label="Total">
                  <span className="tabular font-medium">{formatINR(order.grandTotal)}</span>
                </Row>
                <Row label="Payment">{order.paymentMethod}</Row>
              </div>

              <ul className="flex flex-col gap-1 border-t pt-2">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2 text-xs">
                    {/* The frozen snapshot, not the live product: the customer
                        is asking about what they actually bought. */}
                    <span className="min-w-0 truncate">
                      {item.snapshot.nameEn}
                      <span className="text-muted-foreground"> × {item.quantity}</span>
                    </span>
                    <span className="tabular shrink-0">{formatINR(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/orders/${order.id}`}
                className="text-xs font-medium underline-offset-2 hover:underline"
              >
                Open the order
              </Link>
            </Card>
          ) : (
            /* A general question still needs context. Their recent orders are
               almost always what it turns out to be about. */
            <Card title="Recent orders">
              {customer.orders.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  This customer has not ordered yet — so this is a question before buying.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {customer.orders.slice(0, 3).map((recent) => (
                    <li key={recent.id}>
                      <Link
                        href={`/orders/${recent.id}`}
                        className="hover:bg-muted/40 -mx-1 flex items-center justify-between gap-2 rounded px-1 py-1 transition-colors"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-xs font-medium">{recent.orderNumber}</span>
                          <span className="text-muted-foreground text-xs">
                            {formatStoreDate(recent.placedAt)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <OrderStatusBadge status={recent.status} />
                          <span className="tabular text-xs">{formatINR(recent.grandTotal)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
