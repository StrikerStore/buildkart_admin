'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircleIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { eraseNow } from '@/app/(dashboard)/privacy/actions';

/**
 * Carrying out a deletion request now. Behind a confirmation, because it
 * cannot be undone: the person is removed from the account and what holds
 * them is deleted.
 */
export function EraseNowButton({ id, hasAccount }: { id: string; hasAccount: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isErasing, startErasing] = useTransition();

  function erase() {
    startErasing(async () => {
      const result = await eraseNow(id);
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not erase.');
        return;
      }
      toast.success(hasAccount ? 'Account erased — they are told on WhatsApp' : 'Records for this number erased');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-fit text-[var(--critical-fg)] hover:text-[var(--critical-fg)]"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
        Erase now
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{hasAccount ? 'Erase this account?' : 'Erase what is held for this number?'}</DialogTitle>
            <DialogDescription>
              {hasAccount
                ? 'Their name, contact details, addresses, saved cards, messages, support photos and tracking data are deleted, and the account is closed. Orders and invoices stay, as tax law requires, without their contact details on the account. This cannot be undone.'
                : 'Their sign-in codes, area requests and message logs are deleted. This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Keep
            </Button>
            <Button type="button" variant="destructive" disabled={isErasing} onClick={erase}>
              {isErasing && <LoaderCircleIcon className="size-4 animate-spin" />}
              Erase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
