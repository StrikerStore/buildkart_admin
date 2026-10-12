'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon, RefreshCwIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  EVENT_TOKENS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_EVENT_HINTS,
  NOTIFICATION_EVENT_LABELS,
  channelHasSubject,
  needsProviderTemplateId,
  previewTemplate,
  smsLength,
  toPositional,
  unknownTokens,
  type NotificationChannel,
  type NotificationEvent,
  type NotificationTemplateDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  deleteNotificationTemplate,
  refreshWhatsappTemplate,
  saveNotificationTemplate,
  sendWhatsappTest,
  submitWhatsappTemplate,
} from '@/app/(dashboard)/notifications/actions';
import { cn } from '@/lib/utils';

export type EditorTarget = {
  event: NotificationEvent;
  channel: NotificationChannel;
  locale: 'en' | 'hi';
  existing: NotificationTemplateDto | null;
};

/**
 * The outer half exists only to unmount the inner one.
 *
 * The editor seeds its state from `target` once. Keeping a single instance
 * alive across cells would mean opening a second message and seeing the first
 * one's text — so the guard is a remount, not a hidden render.
 */
export function TemplateEditor({
  target,
  onClose,
}: {
  target: EditorTarget | null;
  onClose: () => void;
}) {
  if (!target) return null;
  return (
    <Editor
      key={`${target.event}:${target.channel}:${target.locale}`}
      target={target}
      onClose={onClose}
    />
  );
}

/**
 * One message, edited.
 *
 * Three things earn their place here and would not in a plain textarea: a token
 * palette that inserts at the cursor, a preview rendered from each token's
 * sample, and an SMS segment counter that knows Hindi costs 70 characters a
 * segment rather than 160. All three are about seeing what will actually be
 * sent before anybody can send it.
 */
function Editor({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState(() => ({
    subject: target.existing?.subject ?? '',
    body: target.existing?.body ?? '',
    providerTemplateId: target.existing?.providerTemplateId ?? '',
    isActive: target.existing?.isActive ?? false,
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const tokens = EVENT_TOKENS[target.event];
  const bad = unknownTokens(form.body, target.event);
  const preview = previewTemplate(form.body, target.event);
  const sms = useMemo(() => smsLength(form.body), [form.body]);

  const wantsSubject = channelHasSubject(target.channel);
  const wantsTemplateId = needsProviderTemplateId(target.channel);

  /** Inserts at the cursor rather than appending — a token belongs mid-sentence. */
  function insert(token: string) {
    const el = bodyRef.current;
    const snippet = `{{${token}}}`;
    if (!el) {
      setForm((c) => ({ ...c, body: c.body + snippet }));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = `${form.body.slice(0, start)}${snippet}${form.body.slice(end)}`;
    setForm((c) => ({ ...c, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  function save() {
    setErrors({});
    setFormError(null);
    startSaving(async () => {
      const result = await saveNotificationTemplate({
        event: target.event,
        channel: target.channel,
        locale: target.locale,
        ...form,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Message saved');
      onClose();
      router.refresh();
    });
  }

  function remove() {
    startDeleting(async () => {
      const result = await deleteNotificationTemplate({
        event: target.event,
        channel: target.channel,
        locale: target.locale,
      });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not delete that.');
        return;
      }
      toast.success('Message deleted');
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>
            {NOTIFICATION_EVENT_LABELS[target.event]} ·{' '}
            {NOTIFICATION_CHANNEL_LABELS[target.channel]}
            {target.locale === 'hi' && ' · हिन्दी'}
          </DialogTitle>
          <DialogDescription>{NOTIFICATION_EVENT_HINTS[target.event]}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {wantsSubject && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={form.subject}
                onChange={(e) => setForm((c) => ({ ...c, subject: e.target.value }))}
              />
              {errors.subject && (
                <span className="text-xs text-[var(--critical-fg)]">{errors.subject}</span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              ref={bodyRef}
              value={form.body}
              onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))}
              rows={5}
              lang={target.locale}
            />

            <div className="flex flex-wrap items-center gap-1">
              <span className="text-muted-foreground mr-1 text-xs">Insert:</span>
              {tokens.map((spec) => (
                <button
                  key={spec.token}
                  type="button"
                  onClick={() => insert(spec.token)}
                  title={spec.note ?? `e.g. ${spec.sample}`}
                  className="bg-muted hover:bg-muted/70 rounded px-1.5 py-0.5 font-mono text-xs transition-colors"
                >
                  {spec.token}
                </button>
              ))}
            </div>

            {errors.body ? (
              <span className="text-xs text-[var(--critical-fg)]">{errors.body}</span>
            ) : bad.length > 0 ? (
              <span className="text-xs text-[var(--critical-fg)]">
                {/* Refused on save too: a token the event cannot fill would
                    send literal braces or blank out mid-sentence. */}
                This event cannot fill in {bad.map((t) => `{{${t}}}`).join(', ')}
              </span>
            ) : null}
          </div>

          {form.body.trim() !== '' && (
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">What it will look like</span>
              <p className="bg-muted/40 rounded-md px-3 py-2.5 text-sm whitespace-pre-wrap">
                {preview}
              </p>

              {target.channel === 'SMS' && (
                <span
                  className={cn(
                    'text-xs',
                    sms.segments > 1 ? 'text-[var(--warning-fg)]' : 'text-muted-foreground',
                  )}
                >
                  {sms.length} characters · {sms.segments} SMS
                  {sms.segments === 1 ? '' : 's'} · {sms.remaining} left in this one
                  {/* Worth saying plainly: a shop writing Hindi will otherwise
                      find out on its first invoice. */}
                  {sms.unicode && ' · Hindi text is billed at 70 characters per SMS, not 160'}
                </span>
              )}
            </div>
          )}

          {wantsTemplateId && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="providerTemplateId">Registered template id</Label>
              <Input
                id="providerTemplateId"
                value={form.providerTemplateId}
                onChange={(e) => setForm((c) => ({ ...c, providerTemplateId: e.target.value }))}
                className="font-mono"
              />
              {errors.providerTemplateId ? (
                <span className="text-xs text-[var(--critical-fg)]">
                  {errors.providerTemplateId}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {target.channel === 'SMS'
                    ? 'The DLT template id. Indian SMS without one is accepted and never delivered.'
                    : 'The approved WhatsApp template name.'}
                </span>
              )}
            </div>
          )}

          {target.channel === 'WHATSAPP' && (
            <WhatsappPanel
              target={target}
              body={form.body}
              savedBody={target.existing?.body ?? null}
              onTemplateName={(name) => setForm((c) => ({ ...c, providerTemplateId: name }))}
            />
          )}

          <label className="flex items-start justify-between gap-4 border-t pt-3">
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Send this one</span>
              <span className="text-muted-foreground text-xs">
                {target.channel === 'WHATSAPP'
                  ? 'Sent through AiSensy while WhatsApp is switched on and the template is approved.'
                  : 'Nothing sends on this channel yet — this decides what will, once a provider is connected.'}
              </span>
            </span>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((c) => ({ ...c, isActive: v }))}
              className="mt-0.5 shrink-0"
            />
          </label>

          {formError && (
            <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={isSaving} onClick={save}>
              {isSaving ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <CheckIcon className="size-4" />
              )}
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {target.existing && (
              <Button
                type="button"
                variant="ghost"
                className="ml-auto"
                disabled={isDeleting}
                onClick={remove}
              >
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'bg-[var(--success-bg)] text-[var(--success-fg)]',
  PENDING: 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
  REJECTED: 'bg-[var(--critical-bg)] text-[var(--critical-fg)]',
  EDITED: 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
};

const STATUS_WORDS: Record<string, string> = {
  APPROVED: 'Approved by WhatsApp',
  PENDING: 'Waiting for WhatsApp approval',
  REJECTED: 'Rejected by WhatsApp',
  EDITED: 'Edited since approval — submit again',
};

/**
 * WhatsApp's half of a message: the text as Meta sees it, its approval, and a
 * test send to a real phone.
 *
 * Submitting works from the *saved* body — that is what the dispatcher will
 * build parameters from, so submitting unsaved text would approve something
 * that is never sent.
 */
function WhatsappPanel({
  target,
  body,
  savedBody,
  onTemplateName,
}: {
  target: EditorTarget;
  body: string;
  savedBody: string | null;
  onTemplateName: (name: string) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState({
    providerStatus: target.existing?.providerStatus ?? '',
    providerRejectedReason: target.existing?.providerRejectedReason ?? '',
  });
  const [phone, setPhone] = useState('');
  const [isSubmitting, startSubmitting] = useTransition();
  const [isRefreshing, startRefreshing] = useTransition();
  const [isTesting, startTesting] = useTransition();

  const positional = toPositional(body);
  const unsaved = savedBody === null || savedBody !== body;
  const isOtp = target.event === 'customer.otp';
  const key = { event: target.event, locale: target.locale };

  function submit() {
    startSubmitting(async () => {
      const result = await submitWhatsappTemplate(key);
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not submit that.');
        return;
      }
      setStatus(result.data);
      onTemplateName(result.data.providerTemplateId);
      toast.success('Submitted. WhatsApp usually answers within minutes.');
      router.refresh();
    });
  }

  function refresh() {
    startRefreshing(async () => {
      const result = await refreshWhatsappTemplate(key);
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not read the status.');
        return;
      }
      setStatus(result.data);
      router.refresh();
    });
  }

  function test() {
    startTesting(async () => {
      const result = await sendWhatsappTest({ ...key, phone });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not send the test.');
        return;
      }
      if (result.data.status === 'SENT') toast.success('Sent. Check the phone.');
      else toast.error(result.data.error ?? `Not sent (${result.data.status.toLowerCase()}).`);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">WhatsApp approval</span>
        {status.providerStatus && (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs',
              STATUS_STYLES[status.providerStatus] ?? 'bg-muted',
            )}
          >
            {STATUS_WORDS[status.providerStatus] ?? status.providerStatus}
          </span>
        )}
      </div>

      {status.providerStatus === 'REJECTED' && status.providerRejectedReason && (
        <p className="text-xs text-[var(--critical-fg)]">{status.providerRejectedReason}</p>
      )}

      {isOtp ? (
        <p className="text-muted-foreground text-xs">
          WhatsApp writes sign-in code messages itself. In AiSensy, create an Authentication
          template with a copy-code button, and paste its name above once it is approved.
        </p>
      ) : (
        body.trim() !== '' && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">What WhatsApp reviews:</span>
            <p className="bg-muted/40 rounded-md px-3 py-2 font-mono text-xs whitespace-pre-wrap">
              {positional.text}
            </p>
            {positional.tokens.length > 0 && (
              <span className="text-muted-foreground text-xs">
                {positional.tokens.map((token, i) => `{{${i + 1}}} = ${token}`).join(' · ')}
              </span>
            )}
          </div>
        )
      )}

      {!isOtp && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting || unsaved || body.trim() === ''}
            onClick={submit}
          >
            {isSubmitting ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
            {status.providerStatus ? 'Submit again' : 'Submit for approval'}
          </Button>
          {(status.providerStatus === 'PENDING' || status.providerStatus === 'REJECTED') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isRefreshing}
              onClick={refresh}
            >
              <RefreshCwIcon className={cn('size-4', isRefreshing && 'animate-spin')} />
              Check status
            </Button>
          )}
          {unsaved && body.trim() !== '' && (
            <span className="text-muted-foreground text-xs">Save the message first.</span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5 border-t pt-3">
        <Label htmlFor="waTestPhone">Send a test</Label>
        <div className="flex items-center gap-2">
          <Input
            id="waTestPhone"
            inputMode="tel"
            placeholder="10-digit mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="max-w-[200px] font-mono"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isTesting || phone.trim().length < 10 || unsaved}
            onClick={test}
          >
            {isTesting ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
            Send
          </Button>
        </div>
        <span className="text-muted-foreground text-xs">
          Filled with the sample values. Needs an approved template name above.
        </span>
      </div>
    </div>
  );
}
