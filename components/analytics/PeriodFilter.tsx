'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ANALYTICS_RANGES,
  ANALYTICS_RANGE_LABELS,
  type AnalyticsPeriodDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * The one filter row above every analytics page: a preset, or a custom pair
 * of days.
 *
 * Driven by the URL, so a period can be bookmarked or sent to someone, and
 * every figure on the page re-renders against the same slice. The API checks
 * the custom range (real days, in order, at most a year) and falls back to 30
 * days rather than erroring, so a hand-edited URL never breaks the page.
 */
export function PeriodFilter({ period }: { period: AnalyticsPeriodDto }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  const go = (query: string) => startTransition(() => router.replace(`${pathname}${query}`));

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 transition-opacity',
        // Hold the previous render rather than flashing a skeleton.
        isPending && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-1">
        {ANALYTICS_RANGES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => go(value === '30d' ? '' : `?range=${value}`)}
            aria-pressed={period.range === value}
            className={cn(
              'rounded-md px-2.5 py-1.5 font-medium transition-colors',
              period.range === value
                ? 'bg-card border shadow-[var(--shadow-card)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {ANALYTICS_RANGE_LABELS[value]}
          </button>
        ))}
      </div>

      <form
        className="flex items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (from && to) go(`?from=${from}&to=${to}`);
        }}
      >
        <Input
          type="date"
          aria-label="From"
          value={from}
          max={to || undefined}
          onChange={(event) => setFrom(event.target.value)}
          className={cn('h-8 w-[9.5rem]', period.range === 'custom' && 'border-foreground/40')}
        />
        <span className="text-muted-foreground text-xs">to</span>
        <Input
          type="date"
          aria-label="To"
          value={to}
          min={from || undefined}
          onChange={(event) => setTo(event.target.value)}
          className={cn('h-8 w-[9.5rem]', period.range === 'custom' && 'border-foreground/40')}
        />
        <Button type="submit" size="sm" variant={period.range === 'custom' ? 'default' : 'outline'}>
          Apply
        </Button>
      </form>
    </div>
  );
}
