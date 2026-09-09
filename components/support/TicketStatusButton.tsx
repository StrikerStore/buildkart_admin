'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckIcon, RotateCcwIcon } from 'lucide-react';
import type { SupportThreadDto } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { setTicketStatus } from '@/app/(dashboard)/support/actions';

/**
 * Resolve, or put it back.
 *
 * One button rather than a status dropdown: WAITING_ON_CUSTOMER is set by
 * replying, never chosen, so the only decision the owner actually makes here is
 * whether the conversation is finished. Offering three states would invite
 * them to set one that sending a message will immediately overwrite.
 */
export function TicketStatusButton({
  ticketId,
  status,
}: {
  ticketId: string;
  status: SupportThreadDto['status'];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const resolved = status === 'RESOLVED';

  function apply() {
    startTransition(async () => {
      const result = await setTicketStatus({
        ticketId,
        status: resolved ? 'OPEN' : 'RESOLVED',
      });

      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not change that. Try again.');
        return;
      }

      toast.success(resolved ? 'Reopened' : 'Marked resolved');
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={resolved ? 'outline' : 'default'}
      size="sm"
      onClick={apply}
      disabled={pending}
    >
      {resolved ? <RotateCcwIcon className="size-4" /> : <CheckIcon className="size-4" />}
      {resolved ? 'Reopen' : 'Mark resolved'}
    </Button>
  );
}
