'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon, XIcon } from 'lucide-react';
import type { AuditAdminOptionDto } from '@StrikerStore/contract';
import { describeEntity } from '@StrikerStore/contract';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

/** "product" reads badly as a heading; "Products" is what the nav calls it. */
const GROUP_LABELS: Record<string, string> = {
  admin: 'Admin account',
  banner: 'Banners',
  category: 'Categories',
  customer: 'Customers',
  delivery: 'Delivery',
  discount: 'Discounts',
  homepage: 'Homepage',
  import: 'CSV imports',
  inventory: 'Stock',
  media: 'Media',
  metafield: 'Custom fields',
  order: 'Orders',
  product: 'Products',
  rates: 'Rates',
  settings: 'Settings',
  tag: 'Tags',
};

/**
 * Filter state lives in the URL for the same reason it does on every other index
 * screen: "what did we change to the cement prices last Tuesday" is a question
 * whose answer someone will want to send to someone else.
 *
 * `ANY` rather than an empty string as the "no filter" option value, because
 * Radix's Select treats `''` as no selection and would render a blank trigger.
 */
const ANY = 'any';

export function AuditFilters({
  admins,
  groups,
  entityTypes,
}: {
  admins: AuditAdminOptionDto[];
  groups: string[];
  entityTypes: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get('q') ?? '');

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === ANY) next.delete(key);
      else next.set(key, value);
    }
    // Any filter change invalidates the cursor — it points into the old result
    // set, and paging on would skip rows that now belong on the first page.
    next.delete('cursor');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  useEffect(() => {
    const current = params.get('q') ?? '';
    if (query === current) return;
    const timer = setTimeout(() => apply({ q: query }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const group = params.get('group') ?? ANY;
  const entityType = params.get('entityType') ?? ANY;
  const adminUserId = params.get('adminUserId') ?? ANY;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const hasFilters = [...params.keys()].some((key) => key !== 'cursor');

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="relative min-w-[220px] flex-1">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Paste an id to see its history"
          className="pl-8"
        />
      </div>

      <Select value={group} onValueChange={(value) => apply({ group: value })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Area" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Every area</SelectItem>
          {groups.map((option) => (
            <SelectItem key={option} value={option}>
              {GROUP_LABELS[option] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={entityType} onValueChange={(value) => apply({ entityType: value })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Everything</SelectItem>
          {entityTypes.map((option) => (
            <SelectItem key={option} value={option}>
              {describeEntity(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Only worth showing once there is more than one person to choose. */}
      {admins.length > 1 && (
        <Select value={adminUserId} onValueChange={(value) => apply({ adminUserId: value })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Who" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Anyone</SelectItem>
            {admins.map((admin) => (
              <SelectItem key={admin.id} value={admin.id}>
                {admin.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Input
        type="date"
        value={from}
        max={to || undefined}
        onChange={(event) => apply({ from: event.target.value })}
        className="w-[150px]"
        aria-label="From date"
      />
      <Input
        type="date"
        value={to}
        min={from || undefined}
        onChange={(event) => apply({ to: event.target.value })}
        className="w-[150px]"
        aria-label="To date"
      />

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
  );
}
