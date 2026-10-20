'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircleIcon, SendIcon, UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  formatStoreDate,
  formatStoreDateTimeShort,
  type IncidentAudienceCountDto,
  type PrivacyIncidentDto,
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
import { Textarea } from '@/components/ui/textarea';
import { countIncidentAudience, sendIncidentNotices } from '@/app/(dashboard)/incidents/actions';
import { cn } from '@/lib/utils';

type Kind = 'ALL' | 'ORDERS' | 'PHONES';

const KINDS: Array<{ value: Kind; label: string; hint: string }> = [
  { value: 'ALL', label: 'Every customer', hint: 'When you cannot tell whose data was involved.' },
  {
    value: 'ORDERS',
    label: 'Customers who ordered between two dates',
    hint: 'When the breach was in the order records for a period.',
  },
  {
    value: 'PHONES',
    label: 'A list of numbers',
    hint: 'When you know exactly whose data it was — including people without an account.',
  },
];

function describeAudience(audience: NonNullable<PrivacyIncidentDto['audience']>): string {
  switch (audience.kind) {
    case 'ALL':
      return 'every customer';
    case 'ORDERS':
      return `customers who ordered ${formatStoreDate(audience.from)} – ${formatStoreDate(audience.to)}`;
    case 'PHONES':
      return `${audience.count} pasted number${audience.count === 1 ? '' : 's'}`;
  }
}

/**
 * Telling the people a breach affected (DPDP Rules 2025, rule 7(1)). Pick who,
 * see how many that is, then send — the notices go out in the background and
 * the counts below climb as they do. Each person is sent it once: pressing
 * Send again finishes an interrupted send, and never repeats one.
 */
export function IncidentNotice({ incident }: { incident: PrivacyIncidentDto }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [phones, setPhones] = useState('');
  const [count, setCount] = useState<IncidentAudienceCountDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  // While notices are going out, the counts come from the server: look again
  // every few seconds until the send finishes.
  useEffect(() => {
    if (!incident.sending) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [incident.sending, router]);

  const audience =
    kind === 'ALL' ? { kind } : kind === 'ORDERS' ? { kind, from, to } : { kind, phones };

  function changed(update: () => void) {
    update();
    setCount(null);
    setError(null);
  }

  function check() {
    setError(null);
    startTransition(async () => {
      const result = await countIncidentAudience({ id: incident.id, audience });
      if (!result.ok) {
        setError(result.formErrors[0] ?? Object.values(result.fieldErrors)[0] ?? 'Check what you entered.');
        return;
      }
      setCount(result.data);
    });
  }

  function send() {
    startTransition(async () => {
      const result = await sendIncidentNotices({ id: incident.id, audience });
      setConfirming(false);
      if (!result.ok) {
        setError(result.formErrors[0] ?? Object.values(result.fieldErrors)[0] ?? 'Could not start sending.');
        return;
      }
      toast.success('Sending — the counts update as they go');
      setCount(null);
      router.refresh();
    });
  }

  const total = count ? count.customers + count.withoutAccount : 0;
  const blocked = !incident.templateReady || !incident.contact;

  return (
    <div className="flex flex-col gap-4">
      {!incident.templateReady && (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-fg)]">
          Set up the “Data breach notice” WhatsApp message first, under Messages, with an approved AiSensy
          campaign — nothing can be sent until it exists.
        </p>
      )}
      {!incident.contact && (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-fg)]">
          Fill in Settings → Grievance officer first: the notice has to tell people who to contact.
        </p>
      )}

      {(incident.principalsNotifiedAt || incident.sending) && (
        <div className="bg-muted/50 flex flex-col gap-1 rounded-md px-3 py-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            {incident.sending && <LoaderCircleIcon className="size-4 animate-spin" />}
            {incident.sending ? 'Sending now' : 'Notices sent'}
            {incident.audience && (
              <span className="text-muted-foreground font-normal">to {describeAudience(incident.audience)}</span>
            )}
          </span>
          <span className="text-muted-foreground text-xs">
            {incident.sends.sent} sent · {incident.sends.queued} waiting to retry · {incident.sends.failed} failed ·{' '}
            {incident.sends.skipped} not sendable (no valid number)
            {incident.principalsNotifiedAt && ` · first sent ${formatStoreDateTimeShort(incident.principalsNotifiedAt)}`}
          </span>
        </div>
      )}

      <fieldset className="flex flex-col gap-2" disabled={incident.sending}>
        <legend className="mb-1 text-sm font-medium">Who it affected</legend>
        {KINDS.map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="audience"
              value={option.value}
              checked={kind === option.value}
              onChange={() => changed(() => setKind(option.value))}
              className="mt-1 size-4 accent-current"
            />
            <span>
              {option.label}
              <span className="text-muted-foreground block text-xs">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {kind === 'ORDERS' && (
        <div className="grid gap-3 sm:max-w-[420px] sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ordersFrom">From</Label>
            <Input id="ordersFrom" type="date" value={from} onChange={(event) => changed(() => setFrom(event.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ordersTo">To (including)</Label>
            <Input id="ordersTo" type="date" value={to} onChange={(event) => changed(() => setTo(event.target.value))} />
          </div>
        </div>
      )}

      {kind === 'PHONES' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="incidentPhones">Mobile numbers</Label>
          <Textarea
            id="incidentPhones"
            value={phones}
            onChange={(event) => changed(() => setPhones(event.target.value))}
            rows={5}
            placeholder={'9826012345\n9826054321'}
            className="font-mono"
          />
          <span className="text-muted-foreground text-xs">One per line, or separated by commas. Up to 5,000.</span>
        </div>
      )}

      {error && <p className="text-sm text-[var(--critical-fg)]">{error}</p>}

      {count && (
        <p className={cn('flex items-center gap-2 text-sm', total === 0 && 'text-muted-foreground')}>
          <UsersIcon className="size-4" />
          {total === 0
            ? 'Nobody matches that.'
            : `${count.customers} customer${count.customers === 1 ? '' : 's'}${
                count.withoutAccount > 0 ? ` and ${count.withoutAccount} number${count.withoutAccount === 1 ? '' : 's'} without an account` : ''
              }.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={isPending || incident.sending} onClick={check}>
          {isPending && !confirming && <LoaderCircleIcon className="size-4 animate-spin" />}
          Check who this reaches
        </Button>
        <Button
          type="button"
          disabled={!count || total === 0 || blocked || isPending || incident.sending}
          onClick={() => setConfirming(true)}
        >
          <SendIcon className="size-4" />
          {count && total > 0 ? `Send to ${total}` : 'Send'}
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Send the breach notice to {total}?</DialogTitle>
            <DialogDescription>
              Each gets the “Data breach notice” WhatsApp with what you wrote above, whatever their message
              settings. It cannot be taken back. Anyone already sent this incident&rsquo;s notice is not sent it
              again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
            <Button type="button" disabled={isPending} onClick={send}>
              {isPending && <LoaderCircleIcon className="size-4 animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
