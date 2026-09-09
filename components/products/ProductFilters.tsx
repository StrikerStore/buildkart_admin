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

const STATUS_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
] as const;

const ALL = '__all__';

/**
 * Filter state lives in the URL, not in component state.
 *
 * That makes a filtered view shareable and survivable across a refresh — and it
 * is what lets the list page stay a Server Component that simply reads its query
 * parameters and queries the database.
 */
export function ProductFilters({
  categories,
  brands,
  tags,
}: {
  categories: Array<{ id: string; nameEn: string }>;
  brands: Array<{ id: string; nameEn: string }>;
  tags: Array<{ id: string; nameEn: string; scope: 'INTERNAL' | 'PUBLIC' }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState(params.get('q') ?? '');

  const status = params.get('status') ?? 'ALL';
  const categoryId = params.get('categoryId') ?? ALL;
  const brandId = params.get('brandId') ?? ALL;
  const tagId = params.get('tagId') ?? ALL;
  const sort = params.get('sort') ?? 'updated';

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

  // Debounce the text search so typing does not fire a query per keystroke.
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
    categoryId !== ALL ||
    brandId !== ALL ||
    tagId !== ALL ||
    sort !== 'updated';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 border-b">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => apply({ status: tab.value === 'ALL' ? null : tab.value })}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 font-medium transition-colors',
                active
                  ? 'border-[var(--nav)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SKU or handle"
            className="pl-8"
          />
        </div>

        <Select value={categoryId} onValueChange={(v) => apply({ categoryId: v })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nameEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={brandId} onValueChange={(v) => apply({ brandId: v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.nameEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tagId} onValueChange={(v) => apply({ tagId: v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {/* Internal tags are marked so a workflow label is never
                    mistaken for a customer-facing one while filtering. */}
                {tag.nameEn}
                {tag.scope === 'INTERNAL' ? ' · internal' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => apply({ sort: v })}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="priceLow">Price: low to high</SelectItem>
            <SelectItem value="priceHigh">Price: high to low</SelectItem>
            <SelectItem value="stockLow">Stock: low first</SelectItem>
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
