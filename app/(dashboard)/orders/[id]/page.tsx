import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrinterIcon, TruckIcon } from 'lucide-react';
import {
  ADMIN_THUMB,
  buildMediaUrl,
  formatINR,
  formatStoreDateTime,
  totalPayments,
  formatStoreDateTimeShort,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { OrderActionBar } from '@/components/orders/OrderActionBar';
import { ArchiveButton } from '@/components/orders/ArchiveButton';
import { DeliveriesCard, type DeliveryLine } from '@/components/orders/DeliveriesCard';
import { OrderNoteEditor } from '@/components/orders/OrderSideControls';
import { PaymentPanel } from '@/components/orders/PaymentPanel';
import { MessageLog } from '@/components/notifications/MessageLog';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { api, serverConfig } from '@/lib/api/server';
import { adminMap } from '@/lib/maps';
import { PinEmbed } from '@/components/maps/PinEmbed';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const orderNumber = await (await api()).orders.orderNumber.query({ id });
  return { title: orderNumber ? `Order ${orderNumber}` : 'Order' };
}


/** A labelled figure in the totals block. */
function TotalRow({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: React.ReactNode;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'font-semibold' : ''}`}>
      <span className={muted ? 'text-muted-foreground' : undefined}>{label}</span>
      <span className="tabular shrink-0">{value}</span>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      {title && <h2 className="font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const client = await api();
  const [order, map, messages] = await Promise.all([
    client.orders.detail.query({ id }),
    adminMap(),
    client.notifications.messages.query({ orderId: id, limit: 20 }),
  ]);
  if (!order) notFound();

  const { publicBaseUrl, transformsEnabled } = (await serverConfig()).media;

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const { address } = order;

  // Totalled from the ledger rather than read off the order, so the figure the
  // panel offers to collect is the same one the action will accept.
  const { outstanding } = totalPayments(order.transactions, order.grandTotal);

  // Each line and how far it has got across the order's loads.
  const progress = new Map(order.fulfillment.map((line) => [line.orderItemId, line]));
  const lines: DeliveryLine[] = order.items.map((item) => {
    const line = progress.get(item.id);
    return {
      id: item.id,
      name: item.snapshot.nameEn,
      detail: item.snapshot.optionValues.join(' / ') || null,
      unitLabel: item.snapshot.unitLabelEn ?? null,
      ordered: line?.ordered ?? item.quantity,
      onRoad: line?.onRoad ?? 0,
      delivered: line?.delivered ?? 0,
      remaining: line?.remaining ?? 0,
    };
  });
  const openShipments = order.shipments.filter((shipment) => shipment.status === 'OUT_FOR_DELIVERY');
  const hasDelivered = order.shipments.some((shipment) => shipment.status === 'DELIVERED');
  const stillToSend = lines.reduce((sum, line) => sum + line.remaining, 0);
  // The challan button prints the load on the road when there is exactly one.
  const challanHref =
    openShipments.length === 1
      ? `/orders/${order.id}/challan?delivery=${openShipments[0]!.id}`
      : `/orders/${order.id}/challan`;

  return (
    <PageContainer>
      <PageHeader
        title={order.orderNumber}
        backHref="/orders"
        backLabel="Orders"
        badge={<OrderStatusBadge status={order.status} />}
        subtitle={[
          `Placed ${formatStoreDateTime(order.placedAt)}`,
          order.status === 'DELIVERED' && order.deliveredAt
            ? `Delivered ${formatStoreDateTime(order.deliveredAt)}`
            : order.status === 'PARTIALLY_DELIVERED'
              ? `${stillToSend} unit${stillToSend === 1 ? '' : 's'} still to send`
              : order.status === 'OUT_FOR_DELIVERY' && order.expectedDeliveryAt
              ? `Expected ${formatStoreDateTime(order.expectedDeliveryAt)}`
              : // What the customer's countdown is running to.
                order.delivery
                ? `Promised by ${formatStoreDateTime(order.delivery.by)}`
                : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Button asChild variant="outline">
              {/* A new tab, because the print dialog replaces the page and the
                  owner is usually mid-way through processing the order. */}
              <a href={`/orders/${order.id}/invoice`} target="_blank" rel="noreferrer">
                <PrinterIcon className="size-4" />
                Print slip
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={challanHref} target="_blank" rel="noreferrer">
                <TruckIcon className="size-4" />
                Delivery challan
              </a>
            </Button>
            {(order.status === 'DELIVERED' || order.status === 'CANCELLED' || order.archivedAt) && (
              <ArchiveButton orderId={order.id} archived={order.archivedAt !== null} />
            )}
            <OrderActionBar
              orderId={order.id}
              status={order.status}
              itemCount={order.items.length}
              lines={lines}
              openShipments={openShipments.length}
              hasDelivered={hasDelivered}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {order.archivedAt && (
            <div className="text-muted-foreground rounded-lg border px-4 py-2.5">
              Archived {formatStoreDateTime(order.archivedAt)} — it is out of the main orders
              list. Unarchive it to bring it back.
            </div>
          )}

          {order.cancelReason && (
            <div className="flex flex-col gap-1 rounded-lg bg-[var(--critical-bg)] px-4 py-3 text-[var(--critical-fg)]">
              <span className="font-semibold">Cancelled</span>
              <span>{order.cancelReason}</span>
            </div>
          )}

          {order.closedShortAt && (
            <div className="flex flex-col gap-1 rounded-lg bg-[var(--warning-bg)] px-4 py-3 text-[var(--warning-fg)]">
              <span className="font-semibold">
                Closed short {formatStoreDateTime(order.closedShortAt)}
              </span>
              {order.closedShortReason && <span>{order.closedShortReason}</span>}
              <span className="text-xs">
                Billed for what was delivered; lines show what was ordered beside it.
              </span>
            </div>
          )}

          <Card title={`${itemCount} item${itemCount === 1 ? '' : 's'}`}>
            <ul className="flex flex-col">
              {order.items.map((item) => {
                const thumb =
                  item.snapshot.imageKey && publicBaseUrl
                    ? buildMediaUrl(publicBaseUrl, transformsEnabled, item.snapshot.imageKey, {
                        w: ADMIN_THUMB,
                      })
                    : null;

                const label = [
                  item.snapshot.optionValues.join(' / '),
                  item.snapshot.sku,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <li key={item.id} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
                    <span className="bg-muted size-10 shrink-0 overflow-hidden rounded border">
                      {thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          width={40}
                          height={40}
                          className="size-full object-cover"
                        />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      {/* The snapshot is what renders, always. The link is a
                          convenience that simply disappears once the product
                          is gone — the order still reads correctly. */}
                      {item.productId ? (
                        <Link
                          href={`/products/${item.productId}`}
                          className="block truncate font-medium hover:underline"
                        >
                          {item.snapshot.nameEn}
                        </Link>
                      ) : (
                        <span className="block truncate font-medium">{item.snapshot.nameEn}</span>
                      )}
                      {label && (
                        <span className="text-muted-foreground block truncate text-xs">{label}</span>
                      )}
                    </span>

                    <span className="text-muted-foreground tabular shrink-0 text-right text-xs">
                      {formatINR(item.unitPrice)}
                      {item.snapshot.unitLabelEn ? ` / ${item.snapshot.unitLabelEn}` : ''}
                      {item.wasBulkPrice && (
                        <span className="ml-1 rounded bg-[var(--info-bg)] px-1 py-0.5 text-[var(--info-fg)]">
                          bulk
                        </span>
                      )}
                      <span className="block">
                        × {item.quantity}
                        {item.orderedQuantity !== null && (
                          <span className="text-[var(--warning-fg)]">
                            {' '}
                            of {item.orderedQuantity} ordered
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="tabular w-[88px] shrink-0 text-right font-medium">
                      {formatINR(item.lineTotal)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-1.5 border-t pt-3">
              <TotalRow label="Subtotal" value={formatINR(order.subtotal)} muted />
              {order.discountTotal !== '0.00' && (
                <TotalRow
                  label={order.discountCode ? `Discount (${order.discountCode})` : 'Discount'}
                  value={`− ${formatINR(order.discountTotal)}`}
                  muted
                />
              )}
              <TotalRow label="Delivery" value={formatINR(order.deliveryCharge)} muted />
              {order.unloadingCharge !== '0.00' && (
                <TotalRow label="Unloading service" value={formatINR(order.unloadingCharge)} muted />
              )}
              <TotalRow label="Total" value={formatINR(order.grandTotal)} strong />
              {/* Already inside the payments below — shown here so the total
                  and what is left to collect can be read side by side. */}
              {order.walletApplied !== '0.00' && (
                <TotalRow
                  label="Paid from wallet"
                  value={`− ${formatINR(order.walletApplied)}`}
                  muted
                />
              )}
              {order.cashbackStatus !== 'NONE' && (
                <TotalRow
                  label={
                    order.cashbackStatus === 'PENDING'
                      ? order.cashbackReleaseAt
                        ? `Cashback · credits ${formatStoreDateTimeShort(order.cashbackReleaseAt)}`
                        : 'Cashback · credits after delivery'
                      : order.cashbackStatus === 'CREDITED'
                        ? 'Cashback · credited'
                        : 'Cashback · withdrawn'
                  }
                  value={formatINR(order.cashbackAmount)}
                  muted
                />
              )}
              {order.bulkPricingApplied && (
                <p className="text-muted-foreground text-xs">Bulk pricing was applied.</p>
              )}
            </div>
          </Card>

          {(order.shipments.length > 0 || order.status === 'PACKED') && (
            <Card title="Deliveries">
              <DeliveriesCard
                orderId={order.id}
                status={order.status}
                paymentMethod={order.paymentMethod}
                lines={lines}
                shipments={order.shipments}
              />
            </Card>
          )}

          <Card title="Timeline">
            <OrderTimeline status={order.status} events={order.events} />
          </Card>

          {messages.messages.length > 0 && (
            <Card title="WhatsApp messages">
              <MessageLog messages={messages.messages} showOrderLink={false} />
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Customer">
            <div className="flex flex-col gap-1">
              <Link
                href={`/customers?q=${encodeURIComponent(order.customer.phone)}`}
                className="font-medium hover:underline"
              >
                {order.customer.name ?? 'Guest'}
              </Link>
              <a href={`tel:${order.customer.phone}`} className="hover:underline">
                {order.customer.phone}
              </a>
              {order.customer.email && (
                <span className="text-muted-foreground truncate">{order.customer.email}</span>
              )}
              <span className="text-muted-foreground text-xs">
                {order.customer.totalOrders} order{order.customer.totalOrders === 1 ? '' : 's'} so far
              </span>
              {order.customer.isBlocked && (
                <span className="mt-1 w-fit rounded-full bg-[var(--critical-bg)] px-2 py-0.5 text-xs font-medium text-[var(--critical-fg)]">
                  Blocked
                </span>
              )}
            </div>
          </Card>

          <Card title="Delivery address">
            {/* Rendered from the snapshot taken when the order was placed, so a
                customer editing their saved address cannot change where a past
                order actually went. */}
            <address className="flex flex-col gap-0.5 not-italic">
              {address.name && <span className="font-medium">{address.name}</span>}
              <span>{address.line1}</span>
              {address.line2 && <span>{address.line2}</span>}
              {address.landmark && (
                <span className="text-muted-foreground">Near {address.landmark}</span>
              )}
              <span>
                {address.city}
                {address.state && `, ${address.state}`} {address.pincode}
              </span>
              {address.phone && (
                <a href={`tel:${address.phone}`} className="mt-1 hover:underline">
                  {address.phone}
                </a>
              )}
            </address>

            {/* The pin the customer dropped — where the rider actually goes.
                Counter orders and older orders have none. */}
            {address.latitude != null && address.longitude != null && (
              <PinEmbed apiKey={map.apiKey} lat={address.latitude} lng={address.longitude} />
            )}
          </Card>

          <Card title="Payment">
            <PaymentPanel
              orderId={order.id}
              paymentMethod={order.paymentMethod}
              paymentStatus={order.paymentStatus}
              gateway={order.paymentGateway}
              instrument={order.paymentInstrument}
              reference={order.paymentReference}
              paidAt={order.paidAt}
              amountPaid={order.amountPaid}
              amountRefunded={order.amountRefunded}
              grandTotal={order.grandTotal}
              outstanding={outstanding}
              transactions={order.transactions}
            />
          </Card>

          {order.customerNote && (
            <Card title="Customer note">
              <p className="whitespace-pre-wrap">{order.customerNote}</p>
            </Card>
          )}

          <Card title="Internal note">
            <OrderNoteEditor orderId={order.id} internalNote={order.internalNote} />
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
