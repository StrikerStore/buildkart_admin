'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BellIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { markRequestsNotified } from '@/app/(dashboard)/delivery/actions';

/**
 * Marks everyone who asked about this pincode as told.
 *
 * It records that they were contacted; it does not send anything itself. The
 * messaging channel is a storefront concern, and a button that claimed to send
 * an SMS while doing nothing would be worse than an honest checkbox.
 */
export function NotifyRequestsButton({ pincode, waiting }: { pincode: string; waiting: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await markRequestsNotified({ pincode });
          if (!result.ok) {
            toast.error(result.formErrors[0] ?? 'Could not update those requests.');
            return;
          }
          toast.success(`${result.data.notified} marked as told`);
          router.refresh();
        })
      }
      title={`${waiting} still to be told about ${pincode}`}
    >
      {isPending ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : (
        <BellIcon className="size-4" />
      )}
      Mark {waiting} told
    </Button>
  );
}
