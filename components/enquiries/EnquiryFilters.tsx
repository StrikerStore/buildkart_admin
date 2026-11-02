'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon } from 'lucide-react';
import { ENQUIRY_INBOX_FILTERS, ENQUIRY_INBOX_FILTER_LABELS } from '@StrikerStore/contract';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Filter state lives in the URL, like `SupportFilters`. New is the default tab. */
const DEFAULT_FILTER = 'NEW';

export function EnquiryFilters({ newCount }: { newCount: number }) {
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 overflow-x-auto border-b">
        {ENQUIRY_INBOX_FILTERS.map((value) => (
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
            {ENQUIRY_INBOX_FILTER_LABELS[value]}
            {value === 'NEW' && newCount > 0 && (
              <span className="rounded-full bg-[var(--brand)] px-1.5 py-px text-xs font-semibold text-black tabular-nums">
                {newCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="relative min-w-[220px] flex-1">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search enquiry number, name or phone"
          className="pl-8"
        />
      </div>
    </div>
  );
}
