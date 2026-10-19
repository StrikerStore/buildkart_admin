'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveIcon, ArchiveRestoreIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setOrdersArchived } from '@/app/(dashboard)/orders/actions';

/**
 * Puts a finished order away from the main list, or brings it back. Shown only
 * on delivered and cancelled orders — the server holds the same rule.
 */
export function ArchiveButton({ orderId, archived }: { orderId: string; archived: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setOrdersArchived({ orderIds: [orderId], archived: !archived });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not update this order.');
        return;
      }
      toast.success(archived ? 'Back in the orders list' : 'Archived');
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="ghost" disabled={isPending} onClick={toggle}>
      {isPending ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : archived ? (
        <ArchiveRestoreIcon className="size-4" />
      ) : (
        <ArchiveIcon className="size-4" />
      )}
      {archived ? 'Unarchive' : 'Archive'}
    </Button>
  );
}
