import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon, ShieldAlertIcon } from 'lucide-react';
import {
  formatStoreDate,
  formatStoreDateTimeShort,
  INCIDENT_STATUS_LABELS,
  type PrivacyIncidentRowDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Incidents' };

/** Where an open breach stands against the Board's 72 hours. */
function boardClock(row: PrivacyIncidentRowDto, now: number) {
  if (row.status === 'CLOSED' || row.boardReportAt) return null;
  const due = Date.parse(row.boardReportDueAt);
  if (due < now) return { tone: 'critical' as const, label: 'Board report overdue' };
  const hours = Math.ceil((due - now) / 3_600_000);
  return { tone: 'warning' as const, label: `Board report due in ${hours} h` };
}

/**
 * Personal data breaches: each one recorded, the people it affected told, and
 * the Data Protection Board told — the record that the duties in rule 7 of the
 * DPDP Rules were met. A shop should rarely have anything here.
 */
export default async function IncidentsPage() {
  await requirePermission('privacy:manage');
  const rows = await (await api()).privacy.incidents.query();
  const now = Date.now();

  return (
    <PageContainer>
      <PageHeader
        title="Incidents"
        subtitle="Personal data breaches: what happened, who was told, and when the Data Protection Board was."
        actions={
          <Button asChild>
            <Link href="/incidents/new">
              <PlusIcon className="size-4" />
              Record a breach
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <div className="bg-card text-muted-foreground flex flex-col items-center gap-2 rounded-lg border px-4 py-12 text-center text-sm shadow-[var(--shadow-card)]">
          <ShieldAlertIcon className="size-6" />
          <p>No breaches recorded.</p>
          <p className="max-w-[460px] text-xs">
            If customers&rsquo; data is ever lost, leaked or seen by someone who should not have it, record it
            here straight away: the Board&rsquo;s detailed report is due within 72 hours of finding out. The
            steps are in backend/docs/PRIVACY.md.
          </p>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          <ul>
            {rows.map((row) => {
              const clock = boardClock(row, now);
              return (
                <li key={row.id} className="border-b last:border-b-0">
                  <Link
                    href={`/incidents/${row.id}`}
                    className="hover:bg-muted/40 flex flex-col gap-1 px-3 py-2.5 transition-colors md:flex-row md:items-center md:gap-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{row.title}</span>
                        <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs">
                          {INCIDENT_STATUS_LABELS[row.status]}
                        </span>
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        Found {formatStoreDateTimeShort(row.detectedAt)} ·{' '}
                        {row.principalsNotifiedAt
                          ? `${row.notifiedCount} customer${row.notifiedCount === 1 ? '' : 's'} told`
                          : 'customers not told yet'}
                        {row.boardReportAt && ` · Board report sent ${formatStoreDate(row.boardReportAt)}`}
                      </span>
                    </span>
                    <span className="shrink-0 md:w-[200px] md:text-right">
                      {clock && (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            clock.tone === 'critical' && 'bg-[var(--critical-bg)] text-[var(--critical-fg)]',
                            clock.tone === 'warning' && 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
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
    </PageContainer>
  );
}
