'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BellIcon, BellOffIcon, SendIcon } from 'lucide-react';
import {
  SUPPORT_MESSAGE_MAX,
  type SupportCannedReplyDto,
  type SupportMessageDto,
  type SupportThreadDto,
} from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThreadPoll } from '@/lib/useThreadPoll';
import { markTicketRead, replyToTicket } from '@/app/(dashboard)/support/actions';
import { playChime, primeChime } from './NotificationChime';
import { MessageList } from './MessageList';

const MUTE_KEY = 'buildkart.support.muted';

/**
 * The conversation, live.
 *
 * Seeded with the messages the server already rendered, then kept current by a
 * poll — so the first paint is complete and correct with JavaScript still
 * loading, and only the *changes* travel after that.
 */
export function SupportThread({
  ticket,
  cannedReplies,
}: {
  ticket: SupportThreadDto;
  cannedReplies: SupportCannedReplyDto[];
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();
  const [muted, setMuted] = useState(false);

  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // localStorage is read after mount, never during render: the server has no
  // idea what this browser prefers, and reading it in the body would make the
  // first client render disagree with the HTML.
  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTE_KEY) === '1');
    } catch {
      // A browser with site data blocked simply gets the default.
    }
  }, []);

  const onInbound = useCallback((incoming: SupportMessageDto[]) => {
    // Only the customer's messages ring. A reply sent from another tab of this
    // same admin is not news to the person who sent it.
    if (!incoming.some((message) => message.authorRole === 'CUSTOMER')) return;
    if (!mutedRef.current) playChime();
  }, []);

  const { messages, status, merge } = useThreadPoll({
    url: `/api/support/${ticket.id}/messages`,
    initial: ticket.messages,
    initialStatus: ticket.status,
    onInbound,
  });

  // Opening the thread is reading it. Fire-and-forget: it moves a timestamp
  // nothing on this screen renders.
  useEffect(() => {
    void markTicketRead({ ticketId: ticket.id });
  }, [ticket.id]);

  function send() {
    const text = body.trim();
    if (text === '' || pending) return;

    startTransition(async () => {
      const result = await replyToTicket({ ticketId: ticket.id, body: text });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not send that. Try again.');
        return;
      }

      /*
       * The composer is cleared and the poll is left to bring the message back.
       * No optimistic append here, unlike the storefront: the owner is at a desk
       * on a good connection, and a message that appears and then re-appears
       * with a different timestamp is worse than one that takes a moment.
       */
      setBody('');
      merge([], 'WAITING_ON_CUSTOMER');
      // The inbox ordering and the sidebar count both moved.
      router.refresh();
    });
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try {
      window.localStorage.setItem(MUTE_KEY, next ? '1' : '0');
    } catch {
      // Preference is lost on reload; the toggle still works for this session.
    }
    if (!next) primeChime();
  }

  const activeReplies = cannedReplies.filter((reply) => reply.isActive);

  return (
    <div className="bg-card flex flex-col overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-muted-foreground text-xs">
          {status === 'RESOLVED'
            ? 'Resolved. A new message from the customer reopens it.'
            : status === 'WAITING_ON_CUSTOMER'
              ? 'Waiting on the customer.'
              : 'Open.'}
        </p>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleMute}
          aria-pressed={muted}
          title={muted ? 'Sound is off' : 'Sound is on'}
        >
          {muted ? <BellOffIcon className="size-4" /> : <BellIcon className="size-4" />}
          <span className="sr-only">{muted ? 'Turn the sound on' : 'Turn the sound off'}</span>
        </Button>
      </div>

      <MessageList messages={messages} side="ADMIN" />

      <div className="flex flex-col gap-2 border-t px-3 py-2.5">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, SUPPORT_MESSAGE_MAX))}
          onFocus={primeChime}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line. This is a chat, and a
            // reply is usually one sentence.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Write a reply…"
          rows={3}
          disabled={pending}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          {activeReplies.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  Saved replies
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-w-[320px]">
                {activeReplies.map((reply) => (
                  <DropdownMenuItem
                    key={reply.id}
                    /* Inserted into the box rather than sent, so the owner can
                       add the order number before it goes out. */
                    onSelect={() => setBody((current) => (current ? `${current}\n${reply.bodyEn}` : reply.bodyEn))}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{reply.title}</span>
                      <span className="text-muted-foreground line-clamp-2 text-xs">
                        {reply.bodyEn}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span />
          )}

          <Button type="button" size="sm" onClick={send} disabled={pending || body.trim() === ''}>
            <SendIcon className="size-4" />
            {pending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
