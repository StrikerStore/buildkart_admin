'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, LoaderCircleIcon, UndoIcon, XCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  canCancel,
  nextStatus,
  previousStatus,
  CANCEL_REASONS,
  ORDER_STATUS_ACTION_LABELS,
  ORDER_STATUS_LABELS,
  formatStoreDateTime,
  parseStoreDateTime,
  toStoreInputValue,
  type OrderStatus,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { advanceOrderStatus, cancelOrder } from '@/app/(dashboard)/orders/actions';
import { cn } from '@/lib/utils';

/**
 * The one place an order's status changes.
 *
 * Every call carries the status the screen was showing. The server treats that
 * as a compare-and-swap, so a tab left open on a stale view is told what
 * actually happened instead of overwriting someone else's work.
 */
export function OrderActionBar({
  orderId,
  status,
  itemCount,
}: {
  orderId: string;
  status: OrderStatus;
  itemCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(true);

  const [timeStep, setTimeStep] = useState<TimedStatus | null>(null);
  const [time, setTime] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);

  const forward = nextStatus(status);
  const back = previousStatus(status);

  function advance(
    toStatus: OrderStatus,
    times: { expectedDeliveryAt?: string; deliveredAt?: string } = {},
  ) {
    startTransition(async () => {
      const result = await advanceOrderStatus({
        orderId,
        toStatus,
        expectedStatus: status,
        ...times,
      });
      if (!result.ok) {
        const message =
          result.fieldErrors.expectedDeliveryAt ??
          result.fieldErrors.deliveredAt ??
          result.formErrors[0] ??
          'Could not update this order.';
        if (timeStep) {
          setTimeError(message);
          return;
        }
        toast.error(message);
        router.refresh();
        return;
      }
      toast.success(`Marked ${ORDER_STATUS_LABELS[result.data.status].toLowerCase()}`);
      setTimeStep(null);
      router.refresh();
    });
  }

  /**
   * Out for delivery and delivered each carry a time the customer is told on
   * WhatsApp, so those two steps ask for it first; the rest move on one click.
   */
  function goForward(toStatus: OrderStatus) {
    if (toStatus === 'OUT_FOR_DELIVERY') {
      setTime(toStoreInputValue(hoursFromNow(2)));
    } else if (toStatus === 'DELIVERED') {
      setTime(toStoreInputValue(new Date()));
    } else {
      advance(toStatus);
      return;
    }
    setTimeError(null);
    setTimeStep(toStatus);
  }

  function submitTime() {
    if (!timeStep || !time) return;
    advance(
      timeStep,
      timeStep === 'OUT_FOR_DELIVERY' ? { expectedDeliveryAt: time } : { deliveredAt: time },
    );
  }

  function submitCancel() {
    const trimmed = reason.trim();
    if (trimmed === '') return;

    startTransition(async () => {
      const result = await cancelOrder({
        orderId,
        expectedStatus: status,
        reason: trimmed,
        restock,
      });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not cancel this order.');
        router.refresh();
        return;
      }
      toast.success(
        result.data.restocked > 0
          ? `Order cancelled, ${result.data.restocked} unit${result.data.restocked === 1 ? '' : 's'} back in stock`
          : 'Order cancelled',
      );
      setCancelOpen(false);
      setReason('');
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {back && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => advance(back)}
            title={`Move back to ${ORDER_STATUS_LABELS[back]}`}
          >
            <UndoIcon className="size-4" />
            Back to {ORDER_STATUS_LABELS[back].toLowerCase()}
          </Button>
        )}

        {canCancel(status) && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setCancelOpen(true)}
            className="text-[var(--critical-fg)] hover:text-[var(--critical-fg)]"
          >
            <XCircleIcon className="size-4" />
            Cancel order
          </Button>
        )}

        {forward && (
          <Button type="button" disabled={isPending} onClick={() => goForward(forward)}>
            {isPending ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <ArrowRightIcon className="size-4" />
            )}
            {ORDER_STATUS_ACTION_LABELS[forward]}
          </Button>
        )}
      </div>

      <Dialog open={cancelOpen} onOpenChange={(open) => !open && setCancelOpen(false)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              The customer keeps the record, and the reason is stored on the order. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <div className="flex flex-wrap gap-1.5">
              {CANCEL_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    reason === preset
                      ? 'border-transparent bg-[var(--neutral-bg)] text-[var(--neutral-fg)] font-medium'
                      : 'hover:bg-muted text-muted-foreground',
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this being cancelled?"
              rows={2}
              maxLength={500}
            />
          </div>

          <label className="flex items-start gap-2.5">
            <Checkbox
              checked={restock}
              onCheckedChange={(checked) => setRestock(checked === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">
                Put {itemCount === 1 ? 'the item' : `all ${itemCount} items`} back in stock
              </span>
              <span className="text-muted-foreground text-xs">
                {/* Stock leaves the shelf when an order is placed, so cancelling
                    is what puts it back. Untick only if the goods are already
                    gone — damaged, or handed over off the books. */}
                Leave this on unless the goods have already left the shop.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setCancelOpen(false)}
            >
              Keep order
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || reason.trim() === ''}
              onClick={submitCancel}
            >
              {isPending && <LoaderCircleIcon className="size-4 animate-spin" />}
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={timeStep !== null} onOpenChange={(open) => !open && setTimeStep(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {timeStep === 'OUT_FOR_DELIVERY' ? 'Send out for delivery' : 'Mark as delivered'}
            </DialogTitle>
            <DialogDescription>
              {timeStep === 'OUT_FOR_DELIVERY'
                ? 'When should the customer expect it? This goes in their out-for-delivery WhatsApp message.'
                : 'When was it handed over? This goes in their delivered WhatsApp message.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="status-time">
              {timeStep === 'OUT_FOR_DELIVERY' ? 'Expected delivery' : 'Delivered on'}
            </Label>
            <Input
              id="status-time"
              type="datetime-local"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
                setTimeError(null);
              }}
              max={timeStep === 'DELIVERED' ? toStoreInputValue(new Date()) : undefined}
            />
            {timeStep === 'OUT_FOR_DELIVERY' && (
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 4].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => {
                      setTime(toStoreInputValue(hoursFromNow(hours)));
                      setTimeError(null);
                    }}
                    className="hover:bg-muted text-muted-foreground rounded-full border px-2.5 py-1 text-xs transition-colors"
                  >
                    In {hours} hour{hours === 1 ? '' : 's'}
                  </button>
                ))}
              </div>
            )}
            {time && !timeError && (
              <span className="text-muted-foreground text-xs">
                The customer sees: {formatStoreDateTime(parseStoreDateTime(time))}
              </span>
            )}
            {timeError && <span className="text-xs text-[var(--critical-fg)]">{timeError}</span>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setTimeStep(null)}
            >
              Back
            </Button>
            <Button type="button" disabled={isPending || !time} onClick={submitTime}>
              {isPending ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <ArrowRightIcon className="size-4" />
              )}
              {timeStep ? ORDER_STATUS_ACTION_LABELS[timeStep] : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type TimedStatus = Extract<OrderStatus, 'OUT_FOR_DELIVERY' | 'DELIVERED'>;

/** Now plus some hours, rounded up to the next half hour — what a rider promises. */
function hoursFromNow(hours: number): Date {
  const at = new Date(Date.now() + hours * 3_600_000);
  const halfHour = 30 * 60_000;
  return new Date(Math.ceil(at.getTime() / halfHour) * halfHour);
}
