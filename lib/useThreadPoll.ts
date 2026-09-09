'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupportMessageDto, SupportThreadDto } from '@buildkart/contract';

/**
 * Adaptive polling, in place of a socket.
 *
 * There is no realtime transport in this stack and adding one — a long-lived
 * connection, a fan-out between API instances — would be a large piece of
 * infrastructure for a shop that has one person answering messages. A poll is
 * the honest size of the problem. What makes it cheap enough is that it is
 * *adaptive*: a focused tab asks every few seconds, a blurred one backs off, and
 * a hidden one stops entirely. A tab left open overnight costs nothing.
 *
 * The cursor is the newest message id the client holds. Because ids are ULIDs
 * the server can answer "everything after this" exactly, so a poll that finds
 * nothing new transfers a few bytes rather than the whole thread.
 */
const FOCUSED_MS = 4_000;
const BLURRED_MS = 20_000;

export type ThreadPoll = {
  messages: SupportMessageDto[];
  status: SupportThreadDto['status'];
  /** Appends a message the caller already knows about, e.g. one it just sent. */
  merge: (incoming: SupportMessageDto[], status?: SupportThreadDto['status']) => void;
  /** Ask now, rather than waiting for the next tick. */
  refresh: () => void;
};

export function useThreadPoll({
  url,
  initial,
  initialStatus,
  onInbound,
}: {
  /** Endpoint taking `?after=<id>` and answering with a SupportThreadDto. */
  url: string;
  initial: SupportMessageDto[];
  initialStatus: SupportThreadDto['status'];
  /** Called with genuinely new messages from the other side. */
  onInbound?: (messages: SupportMessageDto[]) => void;
}): ThreadPoll {
  const [messages, setMessages] = useState(initial);
  const [status, setStatus] = useState(initialStatus);

  /*
   * The cursor is a ref, not state. It has to be readable by the timer callback
   * without re-creating the timer every time a message arrives, and nothing
   * renders from it.
   */
  const cursor = useRef(initial.at(-1)?.id ?? '');
  const inFlight = useRef(false);
  const onInboundRef = useRef(onInbound);
  onInboundRef.current = onInbound;

  /*
   * Mirrors `messages` so `poll` can read the current set without listing it as
   * a dependency — which would rebuild the callback, and with it the timer, on
   * every single message.
   */
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const merge = useCallback(
    (incoming: SupportMessageDto[], nextStatus?: SupportThreadDto['status']) => {
      if (nextStatus) setStatus(nextStatus);
      if (incoming.length === 0) return;

      setMessages((current) => {
        // Ids the client already holds are dropped, so a retried request or an
        // optimistic message the server has now echoed cannot appear twice.
        const held = new Set(current.map((message) => message.id));
        const fresh = incoming.filter((message) => !held.has(message.id));
        if (fresh.length === 0) return current;

        const next = [...current, ...fresh];
        const newest = next.at(-1)?.id;
        if (newest && newest > cursor.current) cursor.current = newest;
        return next;
      });
    },
    [],
  );

  const poll = useCallback(async () => {
    // One request at a time. A slow response on a weak connection must not
    // stack up behind itself.
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const query = cursor.current ? `?after=${encodeURIComponent(cursor.current)}` : '';
      const response = await fetch(`${url}${query}`, { cache: 'no-store' });
      if (!response.ok) return;

      const thread = (await response.json()) as SupportThreadDto;

      /*
       * Filtered here as well as inside `merge`, because the caller needs to
       * know which messages are *genuinely* new — that is what decides whether
       * a sound plays, and replaying the poll must not ring the bell again.
       */
      const held = new Set(messagesRef.current.map((message) => message.id));
      const fresh = thread.messages.filter((message) => !held.has(message.id));

      merge(fresh, thread.status);
      if (fresh.length > 0) onInboundRef.current?.(fresh);
    } catch {
      // A failed poll is not an error worth showing. The next tick tries again,
      // and a message that has not arrived yet looks the same as one that has
      // not been sent.
    } finally {
      inFlight.current = false;
    }
  }, [merge, url]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState !== 'visible') return;
      timer = setTimeout(tick, document.hasFocus() ? FOCUSED_MS : BLURRED_MS);
    };

    const tick = () => {
      void poll().finally(schedule);
    };

    // Returning to the tab asks immediately rather than waiting out the
    // interval — the moment someone looks is the moment they want it current.
    const wake = () => {
      if (document.visibilityState === 'visible') tick();
      else clearTimeout(timer);
    };

    schedule();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('blur', schedule);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('blur', schedule);
    };
  }, [poll]);

  return { messages, status, merge, refresh: () => void poll() };
}
