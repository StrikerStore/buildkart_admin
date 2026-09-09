'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { ANALYTICS_RANGES, ANALYTICS_RANGE_LABELS } from '@StrikerStore/contract';
import { cn } from '@/lib/utils';

/**
 * One filter row above everything it scopes.
 *
 * Deliberately not per-card: every figure and chart on this page re-renders
 * against the same slice, so two numbers on screen can never be describing
 * different periods.
 */
export function RangeFilter({ range }: { range: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        'flex items-center gap-1 transition-opacity',
        // Hold the previous render rather than flashing a skeleton — no layout
        // jump while the new slice loads.
        isPending && 'opacity-60',
      )}
    >
      {ANALYTICS_RANGES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            if (value === '30d') next.delete('range');
            else next.set('range', value);
            startTransition(() => router.replace(`${pathname}?${next.toString()}`));
          }}
          aria-pressed={range === value}
          className={cn(
            'rounded-md px-2.5 py-1.5 font-medium transition-colors',
            range === value
              ? 'bg-card border shadow-[var(--shadow-card)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {ANALYTICS_RANGE_LABELS[value]}
        </button>
      ))}
    </div>
  );
}
