'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveIcon, ArchiveRestoreIcon, LoaderCircleIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setOrdersArchived } from '@/app/(dashboard)/orders/actions';

/**
 * Actions over a selection of orders: archive them, or — in the archived view —
 * bring them back. Nothing else about an order changes when it is archived.
 */
export function OrderBulkBar({
  selectedIds,
  archived,
  onClear,
}: {
  selectedIds: string[];
  archived: boolean;
  onClear: () => void;
}) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();

  function apply() {
    startSaving(async () => {
      const result = await setOrdersArchived({ orderIds: selectedIds, archived: !archived });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not update those orders.');
        return;
      }
      const { changed, skipped } = result.data;
      const noun = `order${changed === 1 ? '' : 's'}`;
      toast.success(
        `${archived ? 'Brought back' : 'Archived'} ${changed} ${noun}` +
          (skipped > 0 ? ` · ${skipped} skipped` : ''),
      );
      onClear();
      router.refresh();
    });
  }

  return (
    <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-[var(--shadow-card)]">
      <span className="font-medium">{selectedIds.length} selected</span>
      <Button type="button" size="sm" disabled={isSaving} onClick={apply}>
        {isSaving ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : archived ? (
          <ArchiveRestoreIcon className="size-4" />
        ) : (
          <ArchiveIcon className="size-4" />
        )}
        {archived ? 'Unarchive' : 'Archive'}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={isSaving} onClick={onClear}>
        <XIcon className="size-4" />
        Clear
      </Button>
    </div>
  );
}
