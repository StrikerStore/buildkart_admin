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
  type OrderStatus,
} from '@buildkart/contract';
import { Button } from '@/components/ui/button';
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

  const forward = nextStatus(status);
  const back = previousStatus(status);

  function advance(toStatus: OrderStatus) {
    startTransition(async () => {
      const result = await advanceOrderStatus({ orderId, toStatus, expectedStatus: status });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not update this order.');
        router.refresh();
        return;
      }
      toast.success(`Marked ${ORDER_STATUS_LABELS[result.data.status].toLowerCase()}`);
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
          <Button type="button" disabled={isPending} onClick={() => advance(forward)}>
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
    </>
  );
}
