'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'new', label: 'One order or none' },
  { value: 'blocked', label: 'Blocked' },
] as const;

const SORTS = [
  { value: 'recent', label: 'Recently ordered' },
  { value: 'spendHigh', label: 'Highest spend' },
  { value: 'ordersHigh', label: 'Most orders' },
  { value: 'name', label: 'Name' },
] as const;

/** Filter state lives in the URL, so a segment is shareable and survives a refresh. */
export function CustomerFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get('q') ?? '');

  const filter = params.get('filter') ?? 'all';
  const sort = params.get('sort') ?? 'recent';

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  useEffect(() => {
    const current = params.get('q') ?? '';
    if (query === current) return;
    const timer = setTimeout(() => apply({ q: query }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasFilters = Boolean(params.get('q')) || filter !== 'all' || sort !== 'recent';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 overflow-x-auto border-b">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => apply({ filter: tab.value === 'all' ? null : tab.value })}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2 font-medium transition-colors',
              filter === tab.value
                ? 'border-[var(--nav)] text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, phone or email"
            className="pl-8"
          />
        </div>

        <Select value={sort} onValueChange={(value) => apply({ sort: value })}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
