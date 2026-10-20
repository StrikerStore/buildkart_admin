import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon, ShieldCheckIcon } from 'lucide-react';
import {
  formatStoreDate,
  formatStoreDateTimeShort,
  isPrivacyRequestOpen,
  PRIVACY_REQUEST_STATUS_LABELS,
  PRIVACY_REQUEST_TYPE_LABELS,
  privacyRequestListSchema,
  type PrivacyRequestRowDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { RecordRequestDialog } from '@/components/privacy/RecordRequestDialog';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Privacy requests' };

const DAY_MS = 86_400_000;

/**
 * Where a request stands against the clock. Overdue is the law's 90 days;
 * "late" is the shorter reply time the shop promises on its website.
 */
function deadline(row: PrivacyRequestRowDto, responseDays: number, now: number) {
  if (!isPrivacyRequestOpen(row.status)) return null;
  const due = Date.parse(row.dueAt);
  if (due < now) return { tone: 'critical' as const, label: 'Overdue' };
  if (Date.parse(row.createdAt) + responseDays * DAY_MS < now) {
    return { tone: 'warning' as const, label: `Past your ${responseDays}-day promise` };
  }
  const days = Math.ceil((due - now) / DAY_MS);
  return { tone: 'muted' as const, label: `${days} day${days === 1 ? '' : 's'} left` };
}

/**
 * When `/cron/privacy` last finished. It is the job that carries out deletions
 * after their cooling-off week and enforces every retention period the Privacy
 * Notice promises — and it fails silently by never running, so the queue says
 * so when it has not.
 */
function cleanupNote(lastCleanupAt: string | null, now: number) {
  if (!lastCleanupAt) {
    return {
      tone: 'warning' as const,
      text: 'The daily privacy clean-up has never run. Point a daily Railway cron at /cron/privacy — until it runs, confirmed account deletions and the retention periods in the Privacy Notice do not happen.',
    };
  }
  const stale = now - Date.parse(lastCleanupAt) > 36 * 60 * 60 * 1000;
  return stale
    ? {
        tone: 'warning' as const,
        text: `The daily privacy clean-up last ran ${formatStoreDateTimeShort(lastCleanupAt)}. Check the /cron/privacy cron on Railway.`,
      }
    : { tone: 'muted' as const, text: `Daily privacy clean-up last ran ${formatStoreDateTimeShort(lastCleanupAt)}.` };
}

/**
 * The privacy queue: what customers — and people without accounts — have asked
 * about their data, nearest deadline first. A work queue, so it opens on what
 * is still waiting.
 */
export default async function PrivacyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('privacy:manage');

  const raw = await searchParams;
  const parsed = privacyRequestListSchema.safeParse({
    view: typeof raw.view === 'string' ? raw.view : undefined,
    page: typeof raw.page === 'string' ? raw.page : undefined,
  });
  const query = parsed.success ? parsed.data : privacyRequestListSchema.parse({});
  const data = await (await api()).privacy.requests.query(query);
  const now = Date.now();
  const cleanup = cleanupNote(data.lastCleanupAt, now);

  const href = (view: string, page = 1) => {
    const params = new URLSearchParams();
    if (view !== 'open') params.set('view', view);
    if (page > 1) params.set('page', String(page));
    return `/privacy${params.toString() ? `?${params}` : ''}`;
  };

  return (
    <PageContainer>
      <PageHeader
        title="Privacy requests"
        subtitle={
          data.overdueCount > 0
            ? `${data.overdueCount} overdue — past the 90 days the law allows`
            : data.openCount > 0
              ? `${data.openCount} waiting. Each is due within 90 days of arriving.`
              : 'Nothing waiting. Requests about customers’ data land here.'
        }
        actions={<RecordRequestDialog />}
      />

      <div className="flex flex-col gap-4">
        <p
          className={cn(
            'text-xs',
            cleanup.tone === 'warning'
              ? 'rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-fg)]'
              : 'text-muted-foreground',
          )}
        >
          {cleanup.text}
        </p>

        <nav className="flex gap-1" aria-label="Filter requests">
          {[
            { view: 'open', label: `Waiting (${data.openCount})` },
            { view: 'closed', label: 'Closed' },
            { view: 'all', label: 'All' },
          ].map((tab) => (
            <Link
              key={tab.view}
              href={href(tab.view)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm',
                query.view === tab.view ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {data.rows.length === 0 ? (
          <div className="bg-card text-muted-foreground flex flex-col items-center gap-2 rounded-lg border px-4 py-12 text-center text-sm shadow-[var(--shadow-card)]">
            <ShieldCheckIcon className="size-6" />
            {query.view === 'open' ? 'No requests waiting.' : 'No requests here yet.'}
          </div>
        ) : (
          <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
            <ul>
              {data.rows.map((row) => {
                const clock = deadline(row, data.responseDays, now);
                return (
                  <li key={row.id} className="border-b last:border-b-0">
                    <Link
                      href={`/privacy/${row.id}`}
                      className="hover:bg-muted/40 flex flex-col gap-1 px-3 py-2.5 transition-colors md:flex-row md:items-center md:gap-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{PRIVACY_REQUEST_TYPE_LABELS[row.type]}</span>
                          <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs">
                            {PRIVACY_REQUEST_STATUS_LABELS[row.status]}
                          </span>
                          {row.source === 'ADMIN' && (
                            <span className="text-muted-foreground text-xs">Recorded by the shop</span>
                          )}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {row.customerName ?? 'No name'} · {row.phone}
                          {!row.customerId && ' · no account'}
                        </span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs md:w-[120px]">
                        Received {formatStoreDate(row.createdAt)}
                      </span>
                      <span className="shrink-0 md:w-[180px] md:text-right">
                        {clock && (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              clock.tone === 'critical' && 'bg-[var(--critical-bg)] text-[var(--critical-fg)]',
                              clock.tone === 'warning' && 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
                              clock.tone === 'muted' && 'text-muted-foreground',
                            )}
                          >
                            {clock.label}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline" size="sm" disabled={query.page <= 1}>
              <Link href={href(query.view, Math.max(1, query.page - 1))} aria-label="Previous page">
                <ChevronLeftIcon className="size-4" />
              </Link>
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {query.page} of {data.totalPages}
            </span>
            <Button asChild variant="outline" size="sm" disabled={query.page >= data.totalPages}>
              <Link href={href(query.view, Math.min(data.totalPages, query.page + 1))} aria-label="Next page">
                <ChevronRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
