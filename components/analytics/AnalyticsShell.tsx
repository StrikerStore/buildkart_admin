import { formatDayKey, type AnalyticsPeriodDto, type AnalyticsQuery } from '@StrikerStore/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { AnalyticsTabs } from './AnalyticsTabs';
import { PeriodFilter } from './PeriodFilter';

/**
 * The frame every analytics page shares: title, the period it covers, the
 * sub-page tabs and the one filter row. A page renders only its own cards.
 */
export function AnalyticsShell({
  active,
  query,
  period,
  note,
  children,
}: {
  active: string;
  query: AnalyticsQuery;
  period: AnalyticsPeriodDto;
  /** A line after the dates — how fresh this page's data is. */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        subtitle={`${formatDayKey(period.from)} to ${formatDayKey(period.to)}${note ? ` · ${note}` : ''}`}
      />
      <div className="flex flex-col gap-4">
        <AnalyticsTabs active={active} query={query} />
        {/* Keyed on the period so the date inputs reset when a preset is picked. */}
        <PeriodFilter key={`${period.from}|${period.to}`} period={period} />
        {children}
      </div>
    </PageContainer>
  );
}

export function AnalyticsCard({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card flex min-w-0 flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
