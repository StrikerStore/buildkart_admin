import Link from 'next/link';
import {
  formatINR,
  formatStoreDateTimeShort,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@StrikerStore/contract';
import { OrderStatusBadge, PaymentStatusBadge } from './OrderStatusBadge';
import type { OrderListItemDto } from '@StrikerStore/contract';

/**
 * The orders index.
 *
 * Read-only, so it stays a Server Component: there is nothing to click here but
 * a link into the order, and shipping a table of this size to the browser to
 * render static rows would be pure cost.
 */
export function OrderListTable({ orders }: { orders: OrderListItemDto[] }) {
  return (
    <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
      <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium md:flex">
        <span className="w-[92px] shrink-0">Order</span>
        <span className="w-[150px] shrink-0">Placed</span>
        <span className="min-w-0 flex-1">Customer</span>
        <span className="w-[128px] shrink-0">Payment</span>
        <span className="w-[140px] shrink-0">Status</span>
        <span className="w-[64px] shrink-0 text-right">Items</span>
        <span className="w-[96px] shrink-0 text-right">Total</span>
      </div>

      <ul>
        {orders.map((order) => (
          <li key={order.id} className="border-b last:border-b-0">
            <Link
              href={`/orders/${order.id}`}
              className="hover:bg-muted/40 flex flex-col gap-2 px-3 py-2.5 transition-colors md:flex-row md:items-center md:gap-3"
            >
              <span className="flex items-center gap-2 md:w-[92px] md:shrink-0">
                <span className="font-medium">{order.orderNumber}</span>
                <span className="md:hidden">
                  <OrderStatusBadge status={order.status} />
                </span>
              </span>

              <span className="text-muted-foreground shrink-0 text-xs md:w-[150px]">
                {formatStoreDateTimeShort(order.placedAt)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate">{order.customerName ?? 'Guest'}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {order.customerPhone}
                  {order.city && ` · ${order.city}`}
                  {order.pincode && ` ${order.pincode}`}
                </span>
              </span>

              <span className="flex shrink-0 flex-col gap-1 md:w-[128px]">
                <PaymentStatusBadge status={order.paymentStatus} />
                <span className="text-muted-foreground truncate text-xs">
                  {/* Once money has moved, where it went through is more useful
                      than what was chosen at checkout — a COD order settled by
                      UPI reads as UPI, not as cash. */}
                  {order.paymentGateway
                    ? PAYMENT_GATEWAY_LABELS[order.paymentGateway]
                    : PAYMENT_METHOD_LABELS[order.paymentMethod]}
                </span>
              </span>

              <span className="hidden shrink-0 md:block md:w-[140px]">
                <OrderStatusBadge status={order.status} />
              </span>

              <span className="text-muted-foreground tabular hidden shrink-0 text-right text-xs md:block md:w-[64px]">
                {order.itemCount}
              </span>

              <span className="tabular shrink-0 text-right font-medium md:w-[96px]">
                {formatINR(order.grandTotal)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
