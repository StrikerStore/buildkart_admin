import { CheckIcon, CircleIcon, XIcon } from 'lucide-react';
import {
  formatStoreDateTime,
  ORDER_FLOW,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '@StrikerStore/contract';
import type { OrderEventDto } from '@StrikerStore/contract';
import { cn } from '@/lib/utils';

/**
 * Where the order is, and how it got there.
 *
 * The rail shows the intended journey with the current position marked; the log
 * beneath it is the actual history, including steps taken back. Keeping both
 * matters — the rail answers "what happens next" at a glance, the log answers
 * "who moved this and when" during a complaint.
 */
export function OrderTimeline({
  status,
  events,
}: {
  status: OrderStatus;
  events: OrderEventDto[];
}) {
  const cancelled = status === 'CANCELLED';
  const reachedIndex = (ORDER_FLOW as readonly OrderStatus[]).indexOf(status);

  // Newest first: the last thing that happened is what anyone opening this
  // screen is looking for.
  const log = [...events].reverse();

  return (
    <div className="flex flex-col gap-4">
      {cancelled ? (
        <div className="flex items-center gap-2 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-[var(--critical-fg)]">
          <XIcon className="size-4 shrink-0" />
          <span className="font-medium">This order was cancelled.</span>
        </div>
      ) : (
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {ORDER_FLOW.map((step, index) => {
            const done = index < reachedIndex;
            const current = index === reachedIndex;
            return (
              <li key={step} className="flex items-center gap-1">
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs whitespace-nowrap',
                    current && 'bg-[var(--info-bg)] font-medium text-[var(--info-fg)]',
                    done && 'text-[var(--success-fg)]',
                    !done && !current && 'text-muted-foreground',
                  )}
                >
                  {done ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    <CircleIcon className={cn('size-3', current && 'fill-current')} />
                  )}
                  {ORDER_STATUS_LABELS[step]}
                </span>
                {index < ORDER_FLOW.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      'h-px w-4',
                      index < reachedIndex ? 'bg-[var(--success)]' : 'bg-border',
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {log.length > 0 && (
        <ul className="flex flex-col gap-3 border-t pt-3">
          {log.map((event) => (
            <li key={event.id} className="flex gap-3">
              <span
                aria-hidden
                className={cn(
                  'mt-1.5 size-2 shrink-0 rounded-full',
                  event.toStatus === 'CANCELLED'
                    ? 'bg-[var(--critical-fg)]'
                    : event.toStatus === 'DELIVERED'
                      ? 'bg-[var(--success)]'
                      : 'bg-border',
                )}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">
                  {event.fromStatus
                    ? `${ORDER_STATUS_LABELS[event.fromStatus]} → ${ORDER_STATUS_LABELS[event.toStatus]}`
                    : ORDER_STATUS_LABELS[event.toStatus]}
                </span>
                {event.note && <span className="text-muted-foreground">{event.note}</span>}
                <span className="text-muted-foreground text-xs">
                  {formatStoreDateTime(event.createdAt)}
                  {event.byName ? ` · ${event.byName}` : ' · storefront'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
