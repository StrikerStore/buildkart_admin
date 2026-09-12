'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangleIcon,
  BanknoteIcon,
  CheckIcon,
  CopyIcon,
  LoaderCircleIcon,
  PlusIcon,
  TrashIcon,
  UndoIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  defaultInstrumentFor,
  formatINR,
  formatStoreDateTime,
  gatewaysForMethod,
  isHostedGateway,
  referenceLabelFor,
  referenceLooksWrong,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_INSTRUMENTS,
  PAYMENT_INSTRUMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TRANSACTION_STATUS_LABELS,
  subtractMoney,
  toPaise,
  type PaymentGateway,
  type PaymentInstrument,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentTransactionStatus,
  type PaymentTransactionType,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PaymentStatusBadge } from './OrderStatusBadge';
import {
  deletePaymentTransaction,
  recordPaymentTransaction,
} from '@/app/(dashboard)/orders/actions';
import type { PaymentTransactionDto } from '@StrikerStore/contract';
import { cn } from '@/lib/utils';

/** Renders the current instant as the `YYYY-MM-DDTHH:mm` a datetime-local wants. */
function nowForInput(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const STATUS_TONES: Record<PaymentTransactionStatus, string> = {
  SUCCESS: 'bg-[var(--success-bg)] text-[var(--success-fg)]',
  FAILED: 'bg-[var(--critical-bg)] text-[var(--critical-fg)]',
  AUTHORIZED: 'bg-[var(--info-bg)] text-[var(--info-fg)]',
  PENDING: 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
};

function CopyableReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard access can be refused outright; the id is on screen to
          // read either way, so there is nothing worth interrupting for.
          toast.error('Could not copy — select the text instead.');
        }
      }}
      className="hover:bg-muted group inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 font-mono transition-colors"
      title="Copy reference"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <CheckIcon className="size-3 shrink-0 text-[var(--success-fg)]" />
      ) : (
        <CopyIcon className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

/** One labelled fact in the payment summary. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  );
}

export function PaymentPanel({
  orderId,
  paymentMethod,
  paymentStatus,
  gateway,
  instrument,
  reference,
  paidAt,
  amountPaid,
  amountRefunded,
  grandTotal,
  outstanding,
  transactions,
}: {
  orderId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  gateway: PaymentGateway | null;
  instrument: PaymentInstrument | null;
  reference: string | null;
  paidAt: string | null;
  amountPaid: string;
  amountRefunded: string;
  grandTotal: string;
  outstanding: string;
  transactions: PaymentTransactionDto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogType, setDialogType] = useState<PaymentTransactionType | null>(null);

  const [status, setStatus] = useState<PaymentTransactionStatus>('SUCCESS');
  const [form, setForm] = useState({
    gateway: gatewaysForMethod(paymentMethod)[0]!,
    instrument: '' as PaymentInstrument | '',
    amount: '',
    reference: '',
    gatewayOrderId: '',
    failureReason: '',
    note: '',
    occurredAt: nowForInput(),
  });

  /*
   * In paise, not floats. `Number(a) - Number(b)` on two money strings lands on
   * values like 3.299999999999997, and this one is prefilled straight into the
   * refund amount — `toFixed(2)` hid that but could still round a paisa off
   * what is actually given back. `subtractMoney` clamps at zero, which is what
   * the `Math.max` was for.
   */
  const refundable = subtractMoney(amountPaid, amountRefunded);

  function open(type: PaymentTransactionType) {
    const initialGateway = gateway ?? gatewaysForMethod(paymentMethod)[0]!;
    setDialogType(type);
    setStatus('SUCCESS');
    setForm({
      gateway: initialGateway,
      instrument: defaultInstrumentFor(initialGateway) ?? '',
      // Prefilled with what is actually owed, or what can still be given back —
      // the figure being typed is nearly always that one.
      amount: type === 'PAYMENT' ? outstanding : refundable,
      reference: '',
      gatewayOrderId: '',
      failureReason: '',
      note: '',
      occurredAt: nowForInput(),
    });
  }

  function submit() {
    if (!dialogType) return;

    startTransition(async () => {
      const result = await recordPaymentTransaction({
        orderId,
        type: dialogType,
        status,
        gateway: form.gateway,
        instrument: form.instrument === '' ? undefined : form.instrument,
        amount: form.amount.trim(),
        reference: form.reference,
        gatewayOrderId: form.gatewayOrderId,
        failureReason: form.failureReason,
        note: form.note,
        occurredAt: new Date(form.occurredAt).toISOString(),
      });

      if (!result.ok) {
        toast.error(result.formErrors[0] ?? Object.values(result.fieldErrors)[0] ?? 'Could not record that.');
        return;
      }

      toast.success(
        dialogType === 'REFUND'
          ? `Refund recorded — ${formatINR(result.data.outstanding)} outstanding`
          : result.data.outstanding === '0.00'
            ? 'Payment recorded — fully paid'
            : `Payment recorded — ${formatINR(result.data.outstanding)} still owed`,
      );
      setDialogType(null);
      router.refresh();
    });
  }

  function remove(transactionId: string) {
    startTransition(async () => {
      const result = await deletePaymentTransaction({ orderId, transactionId });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not remove that entry.');
        return;
      }
      toast.success('Entry removed');
      router.refresh();
    });
  }

  const referenceWarning = referenceLooksWrong(form.gateway, form.reference);
  const amountValid = /^\d+(\.\d{1,2})?$/.test(form.amount.trim()) && Number(form.amount) > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Fact label="Method">{PAYMENT_METHOD_LABELS[paymentMethod]}</Fact>
        <Fact label="Status">
          <PaymentStatusBadge status={paymentStatus} />
        </Fact>

        {/* Gateway, instrument, time and reference only exist once money has
            actually moved — showing empty rows before that would imply a
            payment attempt that never happened. */}
        {gateway && (
          <Fact label="Gateway">
            {PAYMENT_GATEWAY_LABELS[gateway]}
            {instrument && (
              <span className="text-muted-foreground"> · {PAYMENT_INSTRUMENT_LABELS[instrument]}</span>
            )}
          </Fact>
        )}
        {paidAt && <Fact label="Paid at">{formatStoreDateTime(paidAt)}</Fact>}
        {reference && (
          <Fact label="Reference">
            <CopyableReference value={reference} />
          </Fact>
        )}

        <div className="mt-1 flex flex-col gap-1.5 border-t pt-2">
          <Fact label="Order total">
            <span className="tabular">{formatINR(grandTotal)}</span>
          </Fact>
          {amountPaid !== '0.00' && (
            <Fact label="Received">
              <span className="tabular text-[var(--success-fg)]">{formatINR(amountPaid)}</span>
            </Fact>
          )}
          {amountRefunded !== '0.00' && (
            <Fact label="Refunded">
              <span className="tabular">− {formatINR(amountRefunded)}</span>
            </Fact>
          )}
          {outstanding !== '0.00' && (
            <Fact label="Outstanding">
              <span className="tabular font-semibold text-[var(--warning-fg)]">
                {formatINR(outstanding)}
              </span>
            </Fact>
          )}
        </div>
      </div>

      {transactions.length > 0 && (
        <ul className="flex flex-col gap-2 border-t pt-3">
          {transactions.map((entry) => (
            <li key={entry.id} className="group flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                      STATUS_TONES[entry.status],
                    )}
                  >
                    {entry.type === 'REFUND' ? 'Refund' : PAYMENT_TRANSACTION_STATUS_LABELS[entry.status]}
                  </span>
                  <span className="truncate">{PAYMENT_GATEWAY_LABELS[entry.gateway]}</span>
                </span>
                <span className="tabular shrink-0 font-medium">
                  {entry.type === 'REFUND' ? '− ' : ''}
                  {formatINR(entry.amount)}
                </span>
              </div>

              <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">
                  {formatStoreDateTime(entry.occurredAt)}
                  {entry.instrument && ` · ${PAYMENT_INSTRUMENT_LABELS[entry.instrument]}`}
                  {entry.recordedByName && ` · ${entry.recordedByName}`}
                </span>
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  disabled={isPending}
                  className="text-muted-foreground hover:text-[var(--critical-fg)] shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  title="Remove this entry"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>

              {entry.reference && (
                <span className="text-muted-foreground -ml-1 text-xs">
                  <CopyableReference value={entry.reference} />
                </span>
              )}
              {entry.failureReason && (
                <span className="text-xs text-[var(--critical-fg)]">{entry.failureReason}</span>
              )}
              {entry.instrumentDetail && (
                <span className="text-muted-foreground text-xs">
                  {Object.entries(entry.instrumentDetail)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(' · ')}
                </span>
              )}
              {entry.note && <span className="text-muted-foreground text-xs">{entry.note}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button type="button" size="sm" variant="outline" onClick={() => open('PAYMENT')}>
          <PlusIcon className="size-4" />
          Record payment
        </Button>
        {toPaise(refundable) > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => open('REFUND')}>
            <UndoIcon className="size-4" />
            Record refund
          </Button>
        )}
      </div>

      {paymentMethod === 'COD' && outstanding !== '0.00' && (
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
          <BanknoteIcon className="mt-0.5 size-3.5 shrink-0" />
          {/* Marking the order delivered records the cash automatically, so the
              owner does not have to do both. */}
          Delivering this order records {formatINR(outstanding)} collected in cash.
        </p>
      )}

      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'REFUND' ? 'Record a refund' : 'Record a payment'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'REFUND'
                ? `Up to ${formatINR(refundable)} can be refunded on this order.`
                : 'What arrived, when, and under which reference. The payment status is worked out from this.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-amount">Amount</Label>
              <Input
                id="pay-amount"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                // Never type="number": Android keyboards drop the decimal
                // separator, and the target user is on a budget phone.
                inputMode="decimal"
                className="tabular"
                placeholder="4320.00"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-when">When</Label>
              <Input
                id="pay-when"
                type="datetime-local"
                value={form.occurredAt}
                onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Gateway</Label>
              <Select
                value={form.gateway}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    gateway: value as PaymentGateway,
                    // Follow the gateway unless the instrument was set by hand.
                    instrument: defaultInstrumentFor(value as PaymentGateway) ?? f.instrument,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gatewaysForMethod(paymentMethod).map((value) => (
                    <SelectItem key={value} value={value}>
                      {PAYMENT_GATEWAY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Instrument</Label>
              <Select
                value={form.instrument === '' ? 'UNSET' : form.instrument}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    instrument: value === 'UNSET' ? '' : (value as PaymentInstrument),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not recorded" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNSET">Not recorded</SelectItem>
                  {PAYMENT_INSTRUMENTS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PAYMENT_INSTRUMENT_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="pay-ref">{referenceLabelFor(form.gateway)}</Label>
              <Input
                id="pay-ref"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                placeholder={form.gateway === 'RAZORPAY' ? 'pay_QxT9aBcD12efGh' : ''}
                className="font-mono"
              />
              {referenceWarning && (
                <span className="flex items-center gap-1 text-xs text-[var(--warning-fg)]">
                  <AlertTriangleIcon className="size-3.5 shrink-0" />
                  {/* A warning, never a block: gateway id formats change, and
                      refusing to record something that genuinely happened would
                      be worse than an unfamiliar prefix. */}
                  That does not look like a {PAYMENT_GATEWAY_LABELS[form.gateway]} reference. It will
                  still be saved.
                </span>
              )}
            </div>

            {isHostedGateway(form.gateway) && dialogType === 'PAYMENT' && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="pay-order-id">Gateway order id</Label>
                <Input
                  id="pay-order-id"
                  value={form.gatewayOrderId}
                  onChange={(e) => setForm((f) => ({ ...f, gatewayOrderId: e.target.value }))}
                  placeholder="order_QxT9aBcD12efGh"
                  className="font-mono"
                />
              </div>
            )}

            {dialogType === 'PAYMENT' && (
              <div className="flex flex-col gap-1.5">
                <Label>Outcome</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as PaymentTransactionStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['SUCCESS', 'FAILED', 'AUTHORIZED', 'PENDING'] as const).map((value) => (
                      <SelectItem key={value} value={value}>
                        {PAYMENT_TRANSACTION_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {status === 'AUTHORIZED' && (
                  <span className="text-muted-foreground text-xs">
                    A hold, not a receipt — it does not count towards what has been paid.
                  </span>
                )}
              </div>
            )}

            {status === 'FAILED' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pay-failure">Why it failed</Label>
                <Input
                  id="pay-failure"
                  value={form.failureReason}
                  onChange={(e) => setForm((f) => ({ ...f, failureReason: e.target.value }))}
                  placeholder="Insufficient funds"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="pay-note">Note</Label>
              <Input
                id="pay-note"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Anything worth remembering about this payment"
                maxLength={255}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogType(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={isPending || !amountValid} onClick={submit}>
              {isPending && <LoaderCircleIcon className="size-4 animate-spin" />}
              {dialogType === 'REFUND' ? 'Record refund' : 'Record payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
