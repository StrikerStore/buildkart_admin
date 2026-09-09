'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { saveOrderNote } from '@/app/(dashboard)/orders/actions';

/** The private note. Staff-only — nothing here reaches the customer. */
export function OrderNoteEditor({
  orderId,
  internalNote,
}: {
  orderId: string;
  internalNote: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(internalNote ?? '');
  const [isPending, startTransition] = useTransition();

  const dirty = value !== (internalNote ?? '');

  function save() {
    startTransition(async () => {
      const result = await saveOrderNote({ orderId, internalNote: value });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not save the note.');
        return;
      }
      toast.success('Note saved');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Anything the team should know — gate code, call before arriving, part delivery."
        rows={3}
        maxLength={2000}
      />
      {dirty && (
        <Button type="button" size="sm" className="self-end" disabled={isPending} onClick={save}>
          {isPending ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          Save note
        </Button>
      )}
    </div>
  );
}
