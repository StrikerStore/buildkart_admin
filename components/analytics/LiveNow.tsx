'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Mirrors `LiveAnalyticsDto` in the API's `core/src/read/live-analytics.ts`. */
type LiveFunnel = {
  sessions: number;
  viewedProduct: number;
  addedToCart: number;
  reachedCheckout: number;
  ordered: number;
};
type LiveAnalytics = {
  asOf: string;
  windowSeconds: number;
  live: LiveFunnel;
  today: LiveFunnel;
};

/** While this tab is visible. Hidden tabs ask nothing. */
const POLL_MS = 10_000;

const steps: Array<{ key: keyof LiveFunnel; label: string }> = [
  { key: 'viewedProduct', label: 'Viewed a product' },
  { key: 'addedToCart', label: 'Added to cart' },
  { key: 'reachedCheckout', label: 'Reached checkout' },
  { key: 'ordered', label: 'Ordered' },
];

/**
 * Who is on the storefront right now, and today so far, read from the raw
 * sessions rather than the hourly summary the rest of this page uses.
 *
 * Right to within about a minute: the storefront says "still here" every 30
 * seconds while a tab is visible. Only shoppers who allowed analytics on the
 * cookie banner are counted, as everywhere on this page.
 */
export function LiveNow() {
  const [data, setData] = useState<LiveAnalytics | null>(null);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  const poll = useCallback(async () => {
    if (inFlight.current || document.visibilityState !== 'visible') return;
    inFlight.current = true;
    try {
      const response = await fetch('/api/analytics/live', { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      setData((await response.json()) as LiveAnalytics);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    const onVisibility = () => void poll();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [poll]);

  const updated = data
    ? new Date(data.asOf).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="flex items-center gap-2 font-semibold">
            <span className="relative flex size-2.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            Live now
          </h2>
          <p className="text-muted-foreground text-xs">
            Visitors active in the last minute · updates every 10 seconds · only visitors who
            allowed analytics
          </p>
        </div>
        <span className="text-muted-foreground text-xs" aria-live="polite">
          {failed ? 'Could not update — retrying' : updated ? `Updated ${updated}` : 'Loading…'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">On the site now</span>
          <span className="text-4xl leading-tight font-semibold">
            {data ? data.live.sessions.toLocaleString('en-IN') : '—'}
          </span>
          {data && data.live.sessions > 0 && (
            <span className="text-muted-foreground text-xs">
              {data.live.viewedProduct} viewed a product · {data.live.addedToCart} added to cart ·{' '}
              {data.live.reachedCheckout} at checkout
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs">
            Today so far · {data ? data.today.sessions.toLocaleString('en-IN') : '—'} sessions
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map((step) => (
              <div key={step.key} className="bg-muted/40 flex flex-col rounded-md px-3 py-2">
                <span className="text-muted-foreground text-xs">{step.label}</span>
                <span className="text-lg font-semibold">
                  {data ? data.today[step.key].toLocaleString('en-IN') : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
