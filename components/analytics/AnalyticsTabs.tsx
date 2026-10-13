import Link from 'next/link';
import type { AnalyticsQuery } from '@StrikerStore/contract';
import { analyticsQueryString } from '@/lib/analytics-query';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/analytics', label: 'Overview' },
  { href: '/analytics/acquisition', label: 'Acquisition' },
  { href: '/analytics/marketing', label: 'Meta ads' },
  { href: '/analytics/products', label: 'Products' },
  { href: '/analytics/customers', label: 'Customers' },
] as const;

/**
 * The analytics sub-pages. Each link carries the current period, so moving
 * between them never silently resets the window being compared.
 */
export function AnalyticsTabs({ active, query }: { active: string; query: AnalyticsQuery }) {
  const suffix = analyticsQueryString(query);
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b pb-px" aria-label="Analytics">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={`${tab.href}${suffix}`}
          aria-current={active === tab.href ? 'page' : undefined}
          className={cn(
            '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            active === tab.href
              ? 'border-foreground text-foreground'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
