'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon, XIcon } from 'lucide-react';
import { SUPPORT_INBOX_FILTERS, SUPPORT_INBOX_FILTER_LABELS } from '@buildkart/contract';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Filter state lives in the URL, as it does on every other index screen — so a
 * view is shareable and survives a refresh.
 *
 * The one difference from `CustomerFilters`: the default tab is "awaiting"
 * rather than "all", so *that* is the value stripped from the query string.
 * Clearing here means going back to the work queue, not to everything.
 */
const DEFAULT_FILTER = 'awaiting';

export function SupportFilters({ awaitingCount }: { awaitingCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get('q') ?? '');

  const filter = params.get('filter') ?? DEFAULT_FILTER;

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    const search = next.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname));
  }

  useEffect(() => {
    const current = params.get('q') ?? '';
    if (query === current) return;
    const timer = setTimeout(() => apply({ q: query }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasFilters = Boolean(params.get('q')) || filter !== DEFAULT_FILTER;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 overflow-x-auto border-b">
        {SUPPORT_INBOX_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => apply({ filter: value === DEFAULT_FILTER ? null : value })}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 font-medium transition-colors',
              filter === value
                ? 'border-[var(--nav)] text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {SUPPORT_INBOX_FILTER_LABELS[value]}
            {/* Only on the queue tab, and only when it is not empty: the number
                the owner needs is "how many people are waiting", and repeating
                a count on every tab would bury it. */}
            {value === 'awaiting' && awaitingCount > 0 && (
              <span className="rounded-full bg-[var(--brand)] px-1.5 py-px text-xs font-semibold text-black tabular-nums">
                {awaitingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ticket, order number, name or phone"
            className="pl-8"
          />
        </div>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              startTransition(() => router.replace(pathname));
            }}
          >
            <XIcon className="size-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
