'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightIcon,
  LoaderCircleIcon,
  ScissorsIcon,
  UndoIcon,
  XCircleIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  canCancel,
  nextStatus,
  previousStatus,
  CANCEL_REASONS,
  CLOSE_SHORT_REASONS,
  formatINR,
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
import { advanceOrderStatus, cancelOrder, closeOrderShort } from '@/app/(dashboard)/orders/actions';
import { cn } from '@/lib/utils';
import { hoursFromNow, NewDeliveryDialog, type DeliveryLine } from './DeliveriesCard';

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
  lines,
  openShipments,
  hasDelivered,
}: {
  orderId: string;
  status: OrderStatus;
  itemCount: number;
  /** Per line: what is left to send, for "choose items" and "close short". */
  lines: DeliveryLine[];
  /** Loads on the road right now. */
  openShipments: number;
  /** Whether any load has arrived — after which the order is closed short, never cancelled. */
  hasDelivered: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(true);

  const [timeStep, setTimeStep] = useState<TimedStatus | null>(null);
  const [time, setTime] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);

  const [choosing, setChoosing] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closeRestock, setCloseRestock] = useState(true);

  // With several loads on the road, "mark delivered" has to say which: that is
  // done on the deliveries card, so the header offers no forward step.
  const forward = status === 'OUT_FOR_DELIVERY' && openShipments > 1 ? null : nextStatus(status);
  const back = previousStatus(status);
  const notDelivered = lines.filter((line) => line.ordered - line.delivered > 0);

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
      // The status the order actually reached — sending the rest of a partly
      // delivered order, or calling a load back, can land somewhere else.
      toast.success(`Now ${ORDER_STATUS_LABELS[result.data.status].toLowerCase()}`);
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

  function submitCloseShort() {
    const trimmed = closeReason.trim();
    if (trimmed === '') return;
    startTransition(async () => {
      const result = await closeOrderShort({
        orderId,
        reason: trimmed,
        restock: closeRestock,
      });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not close this order.');
        router.refresh();
        return;
      }
      const { grandTotal, refundOwed, stillOwed } = result.data;
      toast.success(
        `Closed short at ${formatINR(grandTotal)}` +
          (refundOwed !== '0.00'
            ? ` — refund ${formatINR(refundOwed)} from the payment panel`
            : stillOwed !== '0.00'
              ? ` — ${formatINR(stillOwed)} still owed`
              : ''),
      );
      setCloseOpen(false);
      setCloseReason('');
      router.refresh();
    });
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
            title={
              status === 'OUT_FOR_DELIVERY'
                ? 'Call back what is on the road; it goes back to still to send'
                : `Move back to ${ORDER_STATUS_LABELS[back]}`
            }
          >
            <UndoIcon className="size-4" />
            {status === 'OUT_FOR_DELIVERY'
              ? `Call back ${openShipments > 1 ? 'deliveries' : 'delivery'}`
              : `Back to ${ORDER_STATUS_LABELS[back].toLowerCase()}`}
          </Button>
        )}

        {status === 'PARTIALLY_DELIVERED' && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setCloseOpen(true)}
          >
            <ScissorsIcon className="size-4" />
            Close short
          </Button>
        )}

        {canCancel(status) && !hasDelivered && (
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
            {status === 'PARTIALLY_DELIVERED'
              ? 'Send the rest'
              : ORDER_STATUS_ACTION_LABELS[forward]}
          </Button>
        )}
      </div>

      <NewDeliveryDialog
        open={choosing}
        onOpenChange={setChoosing}
        orderId={orderId}
        lines={lines}
      />

      <Dialog open={closeOpen} onOpenChange={(open) => !open && setCloseOpen(false)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Close this order short?</DialogTitle>
            <DialogDescription>
              It ends with what was delivered. The rest is not sent, the order and its invoice are
              re-priced to what arrived, and anything paid beyond that is shown as a refund to make.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1 rounded-md bg-[var(--neutral-bg)] p-3 text-sm">
            <span className="font-medium">Not being delivered</span>
            {notDelivered.map((line) => (
              <span key={line.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{line.name}</span>
                <span className="tabular shrink-0">
                  {line.ordered - line.delivered} of {line.ordered}
                </span>
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="close-reason">Reason</Label>
            <div className="flex flex-wrap gap-1.5">
              {CLOSE_SHORT_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCloseReason(preset)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    closeReason === preset
                      ? 'border-transparent bg-[var(--neutral-bg)] text-[var(--neutral-fg)] font-medium'
                      : 'hover:bg-muted text-muted-foreground',
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Textarea
              id="close-reason"
              value={closeReason}
              onChange={(event) => setCloseReason(event.target.value)}
              placeholder="Why is the rest not coming?"
              rows={2}
              maxLength={255}
            />
          </div>

          <label className="flex items-start gap-2.5">
            <Checkbox
              checked={closeRestock}
              onCheckedChange={(checked) => setCloseRestock(checked === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Put what was not delivered back in stock</span>
              <span className="text-muted-foreground text-xs">
                Untick if those goods are not on the shelf — damaged, or never in stock.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setCloseOpen(false)}
            >
              Keep it open
            </Button>
            <Button
              type="button"
              disabled={isPending || closeReason.trim() === ''}
              onClick={submitCloseShort}
            >
              {isPending && <LoaderCircleIcon className="size-4 animate-spin" />}
              Close short
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {timeStep === 'OUT_FOR_DELIVERY' && (
              <button
                type="button"
                className="self-start text-xs underline"
                onClick={() => {
                  setTimeStep(null);
                  setChoosing(true);
                }}
              >
                Send only some of it — choose items
              </button>
            )}
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
