'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  isPrivacyRequestOpen,
  PRIVACY_REQUEST_STATUS_LABELS,
  type PrivacyRequestStatus,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { updatePrivacyRequest } from '@/app/(dashboard)/privacy/actions';

/**
 * Moving a request along, or closing it. Closing needs a note saying what was
 * done — it is sent to the person on WhatsApp, so it is written for them.
 */
export function RequestUpdateForm({
  id,
  status,
  resolution,
  fromAccount,
}: {
  id: string;
  status: PrivacyRequestStatus;
  resolution: string | null;
  /** The customer filed it; only they can withdraw it. */
  fromAccount: boolean;
}) {
  const router = useRouter();
  const [next, setNext] = useState<PrivacyRequestStatus>(status);
  const [note, setNote] = useState(resolution ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const closing = !isPrivacyRequestOpen(next);

  const options: PrivacyRequestStatus[] = fromAccount
    ? ['OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED']
    : ['OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED', 'CANCELLED'];

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await updatePrivacyRequest({ id, status: next, resolution: note });
      if (!result.ok) {
        setError(result.fieldErrors.resolution ?? result.formErrors[0] ?? 'Could not save that.');
        return;
      }
      toast.success(closing ? 'Request closed — the customer is told on WhatsApp' : 'Request updated');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="requestStatus">Status</Label>
        <Select value={next} onValueChange={(value) => setNext(value as PrivacyRequestStatus)}>
          <SelectTrigger id="requestStatus" className="sm:max-w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((value) => (
              <SelectItem key={value} value={value}>
                {PRIVACY_REQUEST_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="requestNote">What was done</Label>
        <Textarea
          id="requestNote"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          placeholder={
            closing
              ? 'Written to the customer, e.g. "We have corrected your delivery address."'
              : 'Optional while it is still open.'
          }
        />
        <span className="text-muted-foreground text-xs">
          {closing
            ? 'Closing sends this to them on WhatsApp (the "Privacy request answered" message).'
            : 'Kept with the request.'}
        </span>
        {error && <span className="text-xs text-[var(--critical-fg)]">{error}</span>}
      </div>

      <Button type="button" className="self-start" disabled={isSaving} onClick={save}>
        {isSaving ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
        Save
      </Button>
    </div>
  );
}
