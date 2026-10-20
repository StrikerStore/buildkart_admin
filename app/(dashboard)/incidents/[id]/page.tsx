import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatStoreDateTimeShort, INCIDENT_STATUS_LABELS } from '@StrikerStore/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { IncidentForm } from '@/components/privacy/IncidentForm';
import { IncidentNotice } from '@/components/privacy/IncidentNotice';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Incident' };

/**
 * One breach: the Board's clock, telling the people it affected, and the
 * record itself. The notice section sits above the form because it is the
 * part with a deadline measured in hours.
 */
export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('privacy:manage');
  const { id } = await params;
  const incident = await (await api()).privacy.incident.query({ id });
  if (!incident) notFound();

  const now = Date.now();
  const due = Date.parse(incident.boardReportDueAt);
  const open = incident.status === 'OPEN';

  return (
    <PageContainer narrow>
      <PageHeader
        backHref="/incidents"
        backLabel="Incidents"
        title={incident.title}
        subtitle={`${INCIDENT_STATUS_LABELS[incident.status]} · found ${formatStoreDateTimeShort(incident.detectedAt)}`}
      />

      <div className="flex flex-col gap-4">
        {open && !incident.boardNotifiedAt && (
          <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-sm text-[var(--critical-fg)]">
            Tell the Data Protection Board without delay, on its online portal — what happened, when, and the
            likely impact — then record when below.
          </p>
        )}
        {open && !incident.boardReportAt && (
          <p
            className={
              due < now
                ? 'rounded-md bg-[var(--critical-bg)] px-3 py-2 text-sm text-[var(--critical-fg)]'
                : 'rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-fg)]'
            }
          >
            {due < now ? 'The detailed report to the Board was due by' : 'The detailed report to the Board is due by'}{' '}
            {formatStoreDateTimeShort(incident.boardReportDueAt)}: what happened, what was done about it, what was
            found about the cause, and how the people affected were told.
          </p>
        )}

        <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-semibold">Tell the people affected</h2>
            <p className="text-muted-foreground text-xs">
              Without delay, on WhatsApp. Save any changes to the wording below first — the notice sends what is
              saved.
              {incident.contact && ` It names ${incident.contact} as the contact.`}
            </p>
          </div>
          <IncidentNotice incident={incident} />
        </section>

        <IncidentForm incident={incident} />
      </div>
    </PageContainer>
  );
}
