'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckIcon,
  LoaderCircleIcon,
  PlusIcon,
  PrinterIcon,
  TruckIcon,
  Undo2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  formatINR,
  formatStoreDateTime,
  ORDER_STATUS_LABELS,
  parseStoreDateTime,
  SHIPMENT_STATUS_LABELS,
  toPaise,
  toStoreInputValue,
  type OrderShipmentDto,
  type OrderStatus,
  type PaymentMethod,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cancelShipment, createShipment, deliverShipment } from '@/app/(dashboard)/orders/actions';
import { cn } from '@/lib/utils';

/** One order line and how far it has got across its loads. */
export type DeliveryLine = {
  id: string;
  name: string;
  detail: string | null;
  unitLabel: string | null;
  ordered: number;
  onRoad: number;
  delivered: number;
  remaining: number;
};

/** Where another load can go out from. */
const SENDABLE: readonly OrderStatus[] = ['PACKED', 'OUT_FOR_DELIVERY', 'PARTIALLY_DELIVERED'];

/** Now plus some hours, rounded up to the next half hour — what a rider promises. */
export function hoursFromNow(hours: number): Date {
  const at = new Date(Date.now() + hours * 3_600_000);
  const halfHour = 30 * 60_000;
  return new Date(Math.ceil(at.getTime() / halfHour) * halfHour);
}

/**
 * The order's loads: what went in each, where each is, what each collected —
 * and what is still to send, with the button that sends it.
 */
export function DeliveriesCard({
  orderId,
  status,
  paymentMethod,
  lines,
  shipments,
}: {
  orderId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  lines: DeliveryLine[];
  shipments: OrderShipmentDto[];
}) {
  const [creating, setCreating] = useState(false);
  const [delivering, setDelivering] = useState<OrderShipmentDto | null>(null);
  const [recalling, setRecalling] = useState<OrderShipmentDto | null>(null);

  const pending = lines.filter((line) => line.remaining > 0);
  const canSend = SENDABLE.includes(status) && pending.length > 0;
  const visible = shipments.filter((shipment) => shipment.status !== 'CANCELLED');
  const calledBack = shipments.length - visible.length;

  return (
    <div className="flex flex-col gap-3">
      {visible.length === 0 && (
        <p className="text-muted-foreground">
          Nothing has gone out yet. Send it all at once from the header, or in loads from here.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {visible.map((shipment) => (
          <li key={shipment.id} className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="font-semibold">Delivery {shipment.number}</span>
                <span className="text-muted-foreground text-xs">{shipment.label}</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs',
                    shipment.status === 'DELIVERED'
                      ? 'bg-[var(--success-bg)] text-[var(--success-fg)]'
                      : 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
                  )}
                >
                  {SHIPMENT_STATUS_LABELS[shipment.status]}
                </span>
              </span>
              <span className="text-muted-foreground text-xs">
                {shipment.status === 'DELIVERED' && shipment.deliveredAt
                  ? `Delivered ${formatStoreDateTime(shipment.deliveredAt)}`
                  : shipment.expectedDeliveryAt
                    ? `Expected ${formatStoreDateTime(shipment.expectedDeliveryAt)}`
                    : null}
              </span>
            </div>

            <ul className="flex flex-col gap-0.5 text-sm">
              {shipment.items.map((item) => {
                const short =
                  item.receivedQuantity !== null && item.receivedQuantity < item.quantity;
                return (
                  <li key={item.orderItemId} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {item.nameEn}
                      {item.detail && (
                        <span className="text-muted-foreground"> · {item.detail}</span>
                      )}
                    </span>
                    <span className="tabular shrink-0">
                      {short ? (
                        <>
                          {item.receivedQuantity} of {item.quantity}
                          <span className="ml-1 text-[var(--warning-fg)]">short</span>
                        </>
                      ) : (
                        <>× {item.quantity}</>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
              <span className="text-muted-foreground text-xs">
                {shipment.cashCollected !== '0.00'
                  ? `Collected ${formatINR(shipment.cashCollected)}`
                  : shipment.toCollect && shipment.toCollect !== '0.00'
                    ? `Collect ${formatINR(shipment.toCollect)} on delivery`
                    : paymentMethod === 'COD' && shipment.status === 'OUT_FOR_DELIVERY'
                      ? 'Nothing to collect'
                      : null}
              </span>
              <span className="flex flex-wrap gap-1.5">
                <Button asChild variant="ghost" size="sm">
                  <a
                    href={`/orders/${orderId}/challan?delivery=${shipment.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <PrinterIcon className="size-4" />
                    Challan
                  </a>
                </Button>
                {shipment.status === 'OUT_FOR_DELIVERY' && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRecalling(shipment)}
                    >
                      <Undo2Icon className="size-4" />
                      Call back
                    </Button>
                    <Button type="button" size="sm" onClick={() => setDelivering(shipment)}>
                      <CheckIcon className="size-4" />
                      Mark delivered
                    </Button>
                  </>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {calledBack > 0 && (
        <p className="text-muted-foreground text-xs">
          {calledBack} {calledBack === 1 ? 'delivery was' : 'deliveries were'} called back.
        </p>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md bg-[var(--neutral-bg)] p-3">
          <span className="font-medium">Still to send</span>
          <ul className="flex flex-col gap-0.5 text-sm">
            {pending.map((line) => (
              <li key={line.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{line.name}</span>
                <span className="tabular shrink-0">
                  {line.remaining} of {line.ordered}
                  {line.unitLabel ? ` ${line.unitLabel}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {canSend && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => setCreating(true)}
            >
              <PlusIcon className="size-4" />
              New delivery
            </Button>
          )}
          {!canSend && !SENDABLE.includes(status) && (
            <span className="text-muted-foreground text-xs">
              {status === 'PLACED' || status === 'CONFIRMED'
                ? 'Confirm and pack the order to start sending it.'
                : `This order is ${ORDER_STATUS_LABELS[status].toLowerCase()}.`}
            </span>
          )}
        </div>
      )}

      <NewDeliveryDialog
        open={creating}
        onOpenChange={setCreating}
        orderId={orderId}
        lines={lines}
      />
      <DeliverDialog
        orderId={orderId}
        paymentMethod={paymentMethod}
        shipment={delivering}
        onClose={() => setDelivering(null)}
      />
      <RecallDialog orderId={orderId} shipment={recalling} onClose={() => setRecalling(null)} />
    </div>
  );
}

/** A clamp for a typed quantity: digits only, never above `max`. */
function quantityInput(raw: string, max: number): number {
  const value = Number(raw.replace(/\D/g, '') || '0');
  return Math.min(Math.max(value, 0), max);
}

/**
 * A new load: how much of each line goes, and when the customer should expect
 * it. Every line starts at what is left to send, so sending "the rest" is one
 * click and a part load is a few numbers turned down.
 */
export function NewDeliveryDialog({
  open,
  onOpenChange,
  orderId,
  lines,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  lines: DeliveryLine[];
}) {
  const router = useRouter();
  const sendable = lines.filter((line) => line.remaining > 0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset to "everything left" each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setQuantities(Object.fromEntries(sendable.map((line) => [line.id, line.remaining])));
    setTime(toStoreInputValue(hoursFromNow(2)));
    setError(null);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const units = Object.values(quantities).reduce((sum, value) => sum + value, 0);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createShipment({
        orderId,
        expectedDeliveryAt: time,
        items: Object.entries(quantities)
          .filter(([, quantity]) => quantity > 0)
          .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      });
      if (!result.ok) {
        setError(
          result.fieldErrors.expectedDeliveryAt ??
            result.formErrors[0] ??
            'Could not send this delivery.',
        );
        return;
      }
      toast.success(`Delivery ${result.data.number} is out — print its challan from the card`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New delivery</DialogTitle>
          <DialogDescription>
            Choose what goes in this load. Anything left stays to send later.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
          {sendable.map((line) => (
            <li key={line.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{line.name}</span>
                <span className="text-muted-foreground block text-xs">
                  {line.remaining} left to send
                  {line.unitLabel ? ` · ${line.unitLabel}` : ''}
                </span>
              </span>
              <Input
                aria-label={`How many ${line.name}`}
                inputMode="numeric"
                value={String(quantities[line.id] ?? 0)}
                onChange={(event) =>
                  setQuantities((current) => ({
                    ...current,
                    [line.id]: quantityInput(event.target.value, line.remaining),
                  }))
                }
                className="tabular w-20 text-right"
              />
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t pt-3">
          <Label htmlFor="delivery-expected">Expected delivery</Label>
          <Input
            id="delivery-expected"
            type="datetime-local"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 4].map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => setTime(toStoreInputValue(hoursFromNow(hours)))}
                className="hover:bg-muted text-muted-foreground rounded-full border px-2.5 py-1 text-xs transition-colors"
              >
                In {hours} hour{hours === 1 ? '' : 's'}
              </button>
            ))}
          </div>
          {time && (
            <span className="text-muted-foreground text-xs">
              The customer sees: {formatStoreDateTime(parseStoreDateTime(time))}
            </span>
          )}
          {error && <span className="text-xs text-[var(--critical-fg)]">{error}</span>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Back
          </Button>
          <Button type="button" disabled={isPending || units === 0 || !time} onClick={submit}>
            {isPending ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <TruckIcon className="size-4" />
            )}
            Send out {units} unit{units === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A load arrived: what actually came (two broken bags are not delivered bags —
 * the shortfall goes back to "still to send"), when, and on a cash-on-delivery
 * order the cash the driver took.
 */
function DeliverDialog({
  orderId,
  paymentMethod,
  shipment,
  onClose,
}: {
  orderId: string;
  paymentMethod: PaymentMethod;
  shipment: OrderShipmentDto | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [received, setReceived] = useState<Record<string, number>>({});
  const [time, setTime] = useState('');
  const [cash, setCash] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [seen, setSeen] = useState<string | null>(null);

  if (shipment && seen !== shipment.id) {
    setSeen(shipment.id);
    setReceived(
      Object.fromEntries(shipment.items.map((item) => [item.orderItemId, item.quantity])),
    );
    setTime(toStoreInputValue(new Date()));
    setCash(shipment.toCollect && shipment.toCollect !== '0.00' ? shipment.toCollect : '');
    setError(null);
  } else if (!shipment && seen !== null) {
    setSeen(null);
  }

  const collectsCash = paymentMethod === 'COD';
  const short = shipment
    ? shipment.items.reduce(
        (sum, item) => sum + (item.quantity - (received[item.orderItemId] ?? item.quantity)),
        0,
      )
    : 0;

  function submit() {
    if (!shipment) return;
    setError(null);
    startTransition(async () => {
      const result = await deliverShipment({
        orderId,
        shipmentId: shipment.id,
        deliveredAt: time,
        items: shipment.items.map((item) => ({
          orderItemId: item.orderItemId,
          receivedQuantity: received[item.orderItemId] ?? item.quantity,
        })),
        ...(collectsCash ? { cashCollected: cash.trim() === '' ? '0' : cash.trim() } : {}),
      });
      if (!result.ok) {
        setError(
          result.fieldErrors.deliveredAt ??
            result.fieldErrors.cashCollected ??
            result.formErrors[0] ??
            'Could not mark this delivery delivered.',
        );
        return;
      }
      toast.success(
        result.data.status === 'DELIVERED'
          ? 'Delivered — the order is complete'
          : `Delivery ${shipment.number} delivered`,
      );
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={shipment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Delivery {shipment?.number} delivered</DialogTitle>
          <DialogDescription>
            Lower a quantity if less arrived than was sent — the rest goes back to &ldquo;still to
            send&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
          {shipment?.items.map((item) => (
            <li key={item.orderItemId} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.nameEn}</span>
                <span className="text-muted-foreground block text-xs">{item.quantity} sent</span>
              </span>
              <Input
                aria-label={`How many ${item.nameEn} arrived`}
                inputMode="numeric"
                value={String(received[item.orderItemId] ?? item.quantity)}
                onChange={(event) =>
                  setReceived((current) => ({
                    ...current,
                    [item.orderItemId]: quantityInput(event.target.value, item.quantity),
                  }))
                }
                className="tabular w-20 text-right"
              />
            </li>
          ))}
        </ul>
        {short > 0 && (
          <p className="text-xs text-[var(--warning-fg)]">
            {short} unit{short === 1 ? '' : 's'} short — back to &ldquo;still to send&rdquo;.
          </p>
        )}

        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivered-at">Delivered on</Label>
            <Input
              id="delivered-at"
              type="datetime-local"
              value={time}
              max={toStoreInputValue(new Date())}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
          {collectsCash && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cash-collected">Cash collected</Label>
              <Input
                id="cash-collected"
                inputMode="decimal"
                value={cash}
                placeholder="0"
                onChange={(event) => setCash(event.target.value.replace(/[^\d.]/g, ''))}
                className="tabular"
              />
              <span className="text-muted-foreground text-xs">
                {shipment?.toCollect && toPaise(shipment.toCollect) > 0
                  ? `The challan asked for ${formatINR(shipment.toCollect)}${
                      short > 0 ? ', for the full load' : ''
                    }.`
                  : 'Nothing was due on this load.'}
              </span>
            </div>
          )}
        </div>
        {error && <span className="text-xs text-[var(--critical-fg)]">{error}</span>}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
            Back
          </Button>
          <Button type="button" disabled={isPending || !time} onClick={submit}>
            {isPending ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
            Mark delivered
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A load called back before it arrives; its goods are "still to send" again. */
function RecallDialog({
  orderId,
  shipment,
  onClose,
}: {
  orderId: string;
  shipment: OrderShipmentDto | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!shipment) return;
    startTransition(async () => {
      const result = await cancelShipment({
        orderId,
        shipmentId: shipment.id,
        reason: reason.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not call this delivery back.');
        return;
      }
      toast.success(`Delivery ${shipment.number} called back`);
      setReason('');
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={shipment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Call back delivery {shipment?.number}?</DialogTitle>
          <DialogDescription>
            Its goods go back to &ldquo;still to send&rdquo;. Nothing is collected and the customer
            is not messaged.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recall-reason">Reason (optional)</Label>
          <Input
            id="recall-reason"
            value={reason}
            maxLength={255}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. vehicle broke down"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
            Keep it out
          </Button>
          <Button type="button" variant="destructive" disabled={isPending} onClick={submit}>
            {isPending && <LoaderCircleIcon className="size-4 animate-spin" />}
            Call back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
