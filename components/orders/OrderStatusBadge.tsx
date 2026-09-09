import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type OrderTone,
  type PaymentStatus,
} from '@StrikerStore/contract';
import { cn } from '@/lib/utils';

const TONE_CLASSES: Record<OrderTone, string> = {
  NEUTRAL: 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)]',
  INFO: 'bg-[var(--info-bg)] text-[var(--info-fg)]',
  ATTENTION: 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
  SUCCESS: 'bg-[var(--success-bg)] text-[var(--success-fg)]',
  CRITICAL: 'bg-[var(--critical-bg)] text-[var(--critical-fg)]',
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[ORDER_STATUS_TONES[status]],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Payment is shown separately from fulfilment, the way Shopify does it, because
 * they genuinely move independently: a cash-on-delivery order can be packed and
 * out for delivery while still unpaid, and collapsing the two into one label
 * would hide exactly the orders the owner needs to chase.
 */
const PAYMENT_TONES: Record<PaymentStatus, OrderTone> = {
  PENDING: 'ATTENTION',
  PAID: 'SUCCESS',
  FAILED: 'CRITICAL',
  REFUNDED: 'NEUTRAL',
  PARTIALLY_REFUNDED: 'NEUTRAL',
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[PAYMENT_TONES[status]],
        className,
      )}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
