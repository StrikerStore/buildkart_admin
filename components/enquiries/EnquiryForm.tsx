'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ENQUIRY_NOTE_MAX,
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_LABELS,
  type EnquiryStatus,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateEnquiry } from '@/app/(dashboard)/enquiries/actions';

/** The status and the staff's own note, saved together. */
export function EnquiryForm({
  id,
  status: initialStatus,
  note: initialNote,
}: {
  id: string;
  status: EnquiryStatus;
  note: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(initialNote);
  const [pending, startTransition] = useTransition();

  const changed = status !== initialStatus || note.trim() !== initialNote;

  function save() {
    startTransition(async () => {
      const result = await updateEnquiry({ id, status, note });
      if (!result.ok) {
        toast.error(
          result.fieldErrors.note ?? result.formErrors[0] ?? 'Could not save that. Try again.',
        );
        return;
      }
      toast.success('Saved');
      router.refresh();
    });
  }

  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enquiryStatus">Status</Label>
        <Select value={status} onValueChange={(value) => setStatus(value as EnquiryStatus)}>
          <SelectTrigger id="enquiryStatus" className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENQUIRY_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {ENQUIRY_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enquiryNote">Internal note</Label>
        <Textarea
          id="enquiryNote"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={ENQUIRY_NOTE_MAX}
          rows={4}
          placeholder="What you agreed, the rate you gave, when to call back"
        />
        <p className="text-muted-foreground text-xs">The customer never sees this.</p>
      </div>

      <Button type="button" className="self-start" onClick={save} disabled={pending || !changed}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </section>
  );
}
