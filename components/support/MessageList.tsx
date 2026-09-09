'use client';

import { useEffect, useRef } from 'react';
import { formatStoreDateTimeShort, type SupportMessageDto } from '@StrikerStore/contract';
import { cn } from '@/lib/utils';

/**
 * The messages, scrolled to the bottom.
 *
 * `side` says which author is "us", so the same component renders the admin's
 * thread and — in the storefront's own copy of this idea — the customer's, with
 * the alignment flipped rather than the logic duplicated.
 */
export function MessageList({
  messages,
  side,
}: {
  messages: SupportMessageDto[];
  side: SupportMessageDto['authorRole'];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  /*
   * Auto-scroll only while the reader is already at the bottom. Someone
   * scrolled up is reading something; yanking them back down when a message
   * arrives is the single most annoying thing a chat can do.
   */
  useEffect(() => {
    const element = scroller.current;
    if (!element || !pinned.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);

  function onScroll() {
    const element = scroller.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    pinned.current = distance < 80;
  }

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      className="flex max-h-[52vh] min-h-[240px] flex-col gap-2.5 overflow-y-auto px-3 py-3"
    >
      {messages.map((message) => {
        const mine = message.authorRole === side;

        return (
          <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'flex max-w-[78%] flex-col gap-1.5 rounded-lg px-3 py-2',
                mine ? 'bg-[var(--nav)] text-white' : 'bg-muted',
              )}
            >
              {message.attachmentUrl && (
                /* Plain <img>, not next/image: the host is R2 behind a
                   configurable public base, and the optimiser would need that
                   domain allow-listed at build time — for a photo shown once. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={message.attachmentUrl}
                  alt="Photo sent with this message"
                  width={message.attachmentWidth ?? undefined}
                  height={message.attachmentHeight ?? undefined}
                  loading="lazy"
                  className="max-h-[280px] w-auto rounded object-contain"
                />
              )}

              {message.body && <p className="wrap-anywhere whitespace-pre-wrap">{message.body}</p>}

              <p className={cn('text-xs', mine ? 'text-white/60' : 'text-muted-foreground')}>
                {message.authorName && `${message.authorName} · `}
                {formatStoreDateTimeShort(message.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
