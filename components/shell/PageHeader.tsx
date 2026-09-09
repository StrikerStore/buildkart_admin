import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shopify's page header: an optional back chevron, the title, an optional status
 * badge beside it, and the actions pinned to the right. Kept as one component so
 * every screen lines up to the same baseline rather than each page inventing its
 * own spacing.
 */
export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  badge,
  actions,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground -ml-1 inline-flex w-fit items-center gap-1 rounded font-medium transition-colors"
        >
          <ChevronLeftIcon className="size-4" />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-xl leading-tight font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && <div className="text-muted-foreground">{subtitle}</div>}
        </div>

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * The page frame. `narrow` matches Shopify's single-column settings width; the
 * default is the wider two-column canvas used by index and detail screens.
 */
export function PageContainer({
  children,
  narrow = false,
  className,
}: {
  children: React.ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-5 sm:px-6 sm:py-6',
        narrow ? 'max-w-[800px]' : 'max-w-[1240px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Shown where a feature will land but hasn't been built yet.
 *
 * Every nav destination resolves to a real page from A1 onward, so the owner can
 * walk the whole information architecture on day one and tell us it's wrong
 * while that is still cheap to change.
 */
export function ComingSoon({ milestone, children }: { milestone: string; children?: React.ReactNode }) {
  return (
    <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
      <span className="bg-neutral-bg text-neutral-fg rounded-full px-2 py-0.5 text-xs font-medium">
        {milestone}
      </span>
      <p className="text-muted-foreground max-w-[420px]">
        {children ?? 'This screen is planned and not built yet.'}
      </p>
    </div>
  );
}
