'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  formatINR,
  formatStoreDateTimeShort,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@StrikerStore/contract';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { OrderStatusBadge, PaymentStatusBadge } from './OrderStatusBadge';
import { OrderBulkBar } from './OrderBulkBar';
import type { OrderListItemDto } from '@StrikerStore/contract';

/**
 * The orders index, with rows that can be selected to archive in bulk.
 *
 * In the working list only delivered and cancelled orders can be ticked — an
 * order still being worked cannot be put away. In the archived view every row
 * can be ticked to bring it back.
 */
export function OrderListTable({
  orders,
  view,
}: {
  orders: OrderListItemDto[];
  view: 'ACTIVE' | 'ARCHIVED';
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // A selection that outlives a filter change would act on rows no longer on
  // screen, so it is cleared whenever the result set changes.
  useEffect(() => setChecked(new Set()), [orders]);

  const selectable = orders.filter(
    (order) => view === 'ARCHIVED' || order.status === 'DELIVERED' || order.status === 'CANCELLED',
  );
  const allChecked = selectable.length > 0 && checked.size === selectable.length;

  return (
    <div className="flex flex-col gap-3">
      {checked.size > 0 ? (
        <OrderBulkBar
          selectedIds={[...checked]}
          archived={view === 'ARCHIVED'}
          onClear={() => setChecked(new Set())}
        />
      ) : (
        selectable.length > 0 && (
          <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(v) =>
                setChecked(v ? new Set(selectable.map((order) => order.id)) : new Set())
              }
              aria-label="Select all"
            />
            {view === 'ARCHIVED'
              ? 'Select orders to bring back to the main list.'
              : 'Select delivered or cancelled orders to archive them.'}
          </div>
        )
      )}

      <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
        <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium md:flex">
          <span className="w-4 shrink-0" />
          <span className="w-[92px] shrink-0">Order</span>
          <span className="w-[150px] shrink-0">Placed</span>
          <span className="min-w-0 flex-1">Customer</span>
          <span className="w-[128px] shrink-0">Payment</span>
          <span className="w-[140px] shrink-0">Status</span>
          <span className="w-[64px] shrink-0 text-right">Items</span>
          <span className="w-[96px] shrink-0 text-right">Total</span>
        </div>

        <ul>
          {orders.map((order) => {
            const canSelect = selectable.includes(order);
            const isChecked = checked.has(order.id);
            return (
              <li
                key={order.id}
                className={cn(
                  'flex items-start gap-3 border-b pl-3 last:border-b-0 md:items-center',
                  isChecked && 'bg-[var(--info-bg)]',
                )}
              >
                <span className="flex w-4 shrink-0 items-center pt-3 md:pt-0">
                  {canSelect && (
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(v) =>
                        setChecked((current) => {
                          const next = new Set(current);
                          if (v) next.add(order.id);
                          else next.delete(order.id);
                          return next;
                        })
                      }
                      aria-label={`Select ${order.orderNumber}`}
                    />
                  )}
                </span>
                <Link
                  href={`/orders/${order.id}`}
                  className="hover:bg-muted/40 flex min-w-0 flex-1 flex-col gap-2 py-2.5 pr-3 transition-colors md:flex-row md:items-center md:gap-3"
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
            );
          })}
        </ul>
      </div>
    </div>
  );
}
