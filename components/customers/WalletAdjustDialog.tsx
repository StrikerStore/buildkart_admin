'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircleIcon, MinusIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatINR } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adjustWallet } from '@/app/(dashboard)/customers/actions';

type Direction = 'CREDIT' | 'DEBIT';

/**
 * Adding or taking away store credit by hand — a goodwill credit after a late
 * delivery, or correcting a mistake.
 *
 * The reason is required and the customer sees it on their wallet statement,
 * which is the point: a balance that moves without an explanation is a
 * support call.
 */
export function WalletAdjustDialog({
  customerId,
  balance,
}: {
  customerId: string;
  balance: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Direction | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [validity, setValidity] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  function start(direction: Direction) {
    setAmount('');
    setNote('');
    setValidity('');
    setErrors({});
    setOpen(direction);
  }

  function save() {
    if (!open) return;
    setErrors({});
    startSaving(async () => {
      const result = await adjustWallet({
        customerId,
        direction: open,
        amount,
        note,
        // Blank is left out, so the server applies the default from the
        // wallet settings rather than reading it as "never expires".
        ...(open === 'CREDIT' && validity !== '' ? { validityDays: validity } : {}),
      });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success(`Wallet is now ${formatINR(result.data.balance)}`);
      setOpen(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => start('CREDIT')}>
          <PlusIcon className="size-4" />
          Add credit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => start('DEBIT')}
          disabled={balance === '0.00'}
        >
          <MinusIcon className="size-4" />
          Deduct
        </Button>
      </div>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{open === 'DEBIT' ? 'Deduct from wallet' : 'Add wallet credit'}</DialogTitle>
            <DialogDescription>
              Current balance {formatINR(balance)}. The customer sees the reason on their wallet
              statement.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wallet-amount">Amount</Label>
              <Input
                id="wallet-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="tabular"
                placeholder="200"
                autoFocus
              />
              {errors.amount && (
                <span className="text-xs text-[var(--critical-fg)]">{errors.amount}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wallet-note">Reason</Label>
              <Textarea
                id="wallet-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={255}
                placeholder={open === 'DEBIT' ? 'Credit added by mistake' : 'Sorry for the late delivery'}
              />
              {errors.note && <span className="text-xs text-[var(--critical-fg)]">{errors.note}</span>}
            </div>

            {open === 'CREDIT' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wallet-validity">Valid for (days)</Label>
                <Input
                  id="wallet-validity"
                  value={validity}
                  onChange={(e) => setValidity(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  className="tabular"
                />
                {errors.validityDays ? (
                  <span className="text-xs text-[var(--critical-fg)]">{errors.validityDays}</span>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Blank uses the default from Discounts → Wallet &amp; cashback.
                  </span>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={open === 'DEBIT' ? 'destructive' : 'default'}
              disabled={isSaving}
              onClick={save}
            >
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              {open === 'DEBIT' ? 'Deduct' : 'Add credit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
