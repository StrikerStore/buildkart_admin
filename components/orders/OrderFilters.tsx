'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon, XIcon } from 'lucide-react';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_GATEWAYS,
  PAYMENT_GATEWAY_LABELS,
} from '@buildkart/contract';
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

const ALL = '__all__';

/**
 * Status tabs mirror the flow, so the row of tabs doubles as a picture of where
 * work is queued. Counts come from the server rather than being derived here —
 * a tab has to show how many orders are waiting even when the current filter
 * excludes them.
 */
const STATUS_TABS = [
  { value: 'ALL', label: 'All' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
] as const;

const RANGES = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
] as const;

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'totalHigh', label: 'Highest total' },
  { value: 'totalLow', label: 'Lowest total' },
] as const;

/**
 * Filter state lives in the URL, not in component state, so a filtered view is
 * shareable and survives a refresh — and the list page stays a Server Component
 * that simply reads its query parameters.
 */
export function OrderFilters({ counts }: { counts: Record<string, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState(params.get('q') ?? '');

  const status = params.get('status') ?? 'ALL';
  const paymentMethod = params.get('paymentMethod') ?? ALL;
  const paymentStatus = params.get('paymentStatus') ?? ALL;
  const gateway = params.get('gateway') ?? ALL;
  const range = params.get('range') ?? 'all';
  const sort = params.get('sort') ?? 'newest';

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === ALL) next.delete(key);
      else next.set(key, value);
    }
    // Any filter change invalidates the current page number.
    next.delete('page');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  // Debounced so typing an order number does not fire a query per keystroke.
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (query === current) return;
    const timer = setTimeout(() => apply({ q: query }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasFilters =
    Boolean(params.get('q')) ||
    status !== 'ALL' ||
    paymentMethod !== ALL ||
    paymentStatus !== ALL ||
    gateway !== ALL ||
    range !== 'all' ||
    sort !== 'newest';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 overflow-x-auto border-b">
        {STATUS_TABS.map((tab) => {
          const count = counts[tab.value] ?? 0;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => apply({ status: tab.value === 'ALL' ? null : tab.value })}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-3 py-2 font-medium transition-colors',
                status === tab.value
                  ? 'border-[var(--nav)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {tab.label}
              {count > 0 && <span className="text-muted-foreground ml-1.5 text-xs">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order number, name, phone or payment reference"
            className="pl-8"
          />
        </div>

        <Select value={range} onValueChange={(value) => apply({ range: value })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={paymentMethod} onValueChange={(value) => apply({ paymentMethod: value })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Any payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any method</SelectItem>
            {PAYMENT_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={paymentStatus} onValueChange={(value) => apply({ paymentStatus: value })}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Any payment status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any payment status</SelectItem>
            {PAYMENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {PAYMENT_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={gateway} onValueChange={(value) => apply({ gateway: value })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Any gateway" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any gateway</SelectItem>
            {PAYMENT_GATEWAYS.map((value) => (
              <SelectItem key={value} value={value}>
                {PAYMENT_GATEWAY_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(value) => apply({ sort: value })}>
          <SelectTrigger className="w-[150px]">
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
