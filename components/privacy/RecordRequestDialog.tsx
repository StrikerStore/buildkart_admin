'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircleIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  PRIVACY_REQUEST_TYPE_LABELS,
  PRIVACY_REQUEST_TYPES,
  type PrivacyRequestType,
} from '@StrikerStore/contract';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { recordPrivacyRequest } from '@/app/(dashboard)/privacy/actions';

/**
 * Logging a request that did not come through the website — a call, an email,
 * a letter, or someone with no account at all (a pincode requester, an order's
 * receiver). It joins the same queue, with the same 90-day deadline.
 */
export function RecordRequestDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PrivacyRequestType>('ERASURE');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await recordPrivacyRequest({ type, phone, channel, details });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Request recorded');
      setOpen(false);
      setPhone('');
      setChannel('');
      setDetails('');
      router.push(`/privacy/${result.data.id}`);
    });
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Record a request
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Record a privacy request</DialogTitle>
            <DialogDescription>
              For a request that came by phone, email or post. It is due within 90 days of today.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="requestType">What they asked for</Label>
              <Select value={type} onValueChange={(value) => setType(value as PrivacyRequestType)}>
                <SelectTrigger id="requestType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIVACY_REQUEST_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PRIVACY_REQUEST_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="requestPhone">Their mobile number</Label>
              <Input
                id="requestPhone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                placeholder="9826000000"
              />
              {errors.phone && <span className="text-xs text-[var(--critical-fg)]">{errors.phone}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="requestChannel">How it came in</Label>
              <Input
                id="requestChannel"
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                placeholder="Phone call, email, letter"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="requestDetails">What they said</Label>
              <Textarea
                id="requestDetails"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                rows={4}
              />
              {errors.details && (
                <span className="text-xs text-[var(--critical-fg)]">{errors.details}</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSaving} onClick={save}>
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
