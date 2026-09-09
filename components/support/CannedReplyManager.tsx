'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { SUPPORT_MESSAGE_MAX, type SupportCannedReplyDto } from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { deleteCannedReply, saveCannedReply } from '@/app/(dashboard)/support/actions';

type Draft = {
  id?: string;
  title: string;
  bodyEn: string;
  bodyHi: string;
  position: number;
  isActive: boolean;
};

const BLANK: Draft = { title: '', bodyEn: '', bodyHi: '', position: 0, isActive: true };

const toDraft = (reply: SupportCannedReplyDto): Draft => ({
  id: reply.id,
  title: reply.title,
  bodyEn: reply.bodyEn,
  bodyHi: reply.bodyHi ?? '',
  position: reply.position,
  isActive: reply.isActive,
});

/**
 * List on the left, one editor below it.
 *
 * A single editor rather than an inline form per row: there are rarely more
 * than a dozen of these, they are edited one at a time, and a page of twelve
 * open textareas is harder to read than a list plus a form.
 */
export function CannedReplyManager({ replies }: { replies: SupportCannedReplyDto[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function save() {
    if (!draft) return;

    startTransition(async () => {
      const result = await saveCannedReply({ ...draft, bodyHi: draft.bodyHi });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }

      setErrors({});
      setDraft(null);
      toast.success('Saved');
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteCannedReply({ id });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not delete that.');
        return;
      }
      if (draft?.id === id) setDraft(null);
      toast.success('Deleted');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
        {replies.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center">
            Nothing saved yet. Add the answer you find yourself typing most.
          </p>
        ) : (
          <ul>
            {replies.map((reply) => (
              <li
                key={reply.id}
                className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    setErrors({});
                    setDraft(toDraft(reply));
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{reply.title}</span>
                    {!reply.isActive && (
                      <span className="text-muted-foreground bg-muted shrink-0 rounded-full px-2 py-0.5 text-xs">
                        Off
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {reply.bodyEn}
                  </span>
                </button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(reply.id)}
                  disabled={pending}
                >
                  <Trash2Icon className="size-4" />
                  <span className="sr-only">Delete {reply.title}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {draft === null ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setErrors({});
            setDraft({ ...BLANK, position: replies.length });
          }}
          className="w-fit"
        >
          <PlusIcon className="size-4" />
          Add a reply
        </Button>
      ) : (
        <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply-title">Name</Label>
            <Input
              id="reply-title"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Delivery running late"
              aria-invalid={Boolean(errors.title)}
            />
            <p className="text-muted-foreground text-xs">
              {errors.title ?? 'Only you see this — it is how you find the reply in the list.'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply-body">Message</Label>
            <Textarea
              id="reply-body"
              rows={4}
              value={draft.bodyEn}
              onChange={(event) =>
                setDraft({ ...draft, bodyEn: event.target.value.slice(0, SUPPORT_MESSAGE_MAX) })
              }
              aria-invalid={Boolean(errors.bodyEn)}
            />
            {errors.bodyEn && <p className="text-xs text-[var(--critical-fg)]">{errors.bodyEn}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply-body-hi">Message in Hindi</Label>
            <Textarea
              id="reply-body-hi"
              rows={4}
              value={draft.bodyHi}
              onChange={(event) =>
                setDraft({ ...draft, bodyHi: event.target.value.slice(0, SUPPORT_MESSAGE_MAX) })
              }
            />
            <p className="text-muted-foreground text-xs">
              Optional. Left blank, the English version is offered instead.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="reply-active"
              checked={draft.isActive}
              onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })}
            />
            <Label htmlFor="reply-active">Offer this while replying</Label>
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
