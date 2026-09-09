'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon, Trash2Icon } from 'lucide-react';
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
  saveNotificationTemplate,
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

          <label className="flex items-start justify-between gap-4 border-t pt-3">
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Send this one</span>
              <span className="text-muted-foreground text-xs">
                Nothing sends yet — this decides what will, once a provider is
                connected.
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
