import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DownloadIcon, UserIcon } from 'lucide-react';
import {
  formatStoreDate,
  formatStoreDateTimeShort,
  isPrivacyRequestOpen,
  PRIVACY_REQUEST_STATUS_LABELS,
  PRIVACY_REQUEST_TYPE_LABELS,
} from '@StrikerStore/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { EraseNowButton } from '@/components/privacy/EraseNowButton';
import { RequestUpdateForm } from '@/components/privacy/RequestUpdateForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Privacy request' };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** What to do for each kind of request — the owner's checklist, not the law's text. */
const GUIDANCE: Record<string, string> = {
  ACCESS:
    'Download their data below and send it to them — on WhatsApp or by email, to the number or address on the account.',
  CORRECTION:
    'Fix what they asked for on their customer page (name, email, addresses), or tell them why it is already right.',
  ERASURE:
    '"Erase now" deletes them from the account and everything that holds them, keeping orders and invoices as tax law requires. It refuses while an order is still on its way or unpaid — finish or cancel that first. They are told on WhatsApp.',
  GRIEVANCE: 'Answer their question or complaint. If they are not satisfied, they may go to the Data Protection Board.',
  NOMINATION: 'Record the nominee they named. Customers can also do this themselves from their account.',
  CONSENT_WITHDRAWAL:
    'Turn off what they withdrew. Customers can do this themselves from their account settings.',
};

export default async function PrivacyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('privacy:manage');
  const { id } = await params;
  const request = await (await api()).privacy.request.query({ id });
  if (!request) notFound();

  const open = isPrivacyRequestOpen(request.status);
  const overdue = open && Date.parse(request.dueAt) < Date.now();

  return (
    <PageContainer narrow>
      <PageHeader
        backHref="/privacy"
        backLabel="Privacy requests"
        title={PRIVACY_REQUEST_TYPE_LABELS[request.type]}
        subtitle={`${PRIVACY_REQUEST_STATUS_LABELS[request.status]} · received ${formatStoreDate(request.createdAt)} · ${
          open ? `${overdue ? 'was due' : 'due by'} ${formatStoreDate(request.dueAt)}` : `closed ${request.resolvedAt ? formatStoreDate(request.resolvedAt) : ''}`
        }`}
      />

      <div className="flex flex-col gap-4">
        {overdue && (
          <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-sm text-[var(--critical-fg)]">
            This request is past the 90 days the DPDP Rules allow. Answer it now.
          </p>
        )}

        <Card title="What they asked">
          <p className="text-sm whitespace-pre-wrap">{request.details}</p>
          <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt>From</dt>
            <dd>
              {request.customerName ?? 'No name'} · {request.phone}
              {!request.customerId && ' · no account with this number'}
            </dd>
            <dt>Came in</dt>
            <dd>{request.source === 'ACCOUNT' ? 'From their account' : (request.channel ?? 'Recorded by the shop')}</dd>
            {request.handledByName && (
              <>
                <dt>Handled by</dt>
                <dd>{request.handledByName}</dd>
              </>
            )}
            <dt>Last change</dt>
            <dd>{formatStoreDateTimeShort(request.updatedAt)}</dd>
          </dl>
          {request.customerErased && (
            <p className="text-sm font-medium">This customer&apos;s account has been erased.</p>
          )}
          {request.customerId && !request.customerErased && (
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href={`/customers/${request.customerId}`} className="inline-flex items-center gap-1.5 hover:underline">
                <UserIcon className="size-4" />
                Open customer
              </Link>
              <a
                href={`/api/privacy/export/${request.customerId}`}
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                <DownloadIcon className="size-4" />
                Download their data
              </a>
            </div>
          )}
        </Card>

        {GUIDANCE[request.type] && (
          <p className="text-muted-foreground rounded-md border px-3 py-2 text-xs">{GUIDANCE[request.type]}</p>
        )}

        {request.type === 'ERASURE' && open && !request.customerErased && (
          <Card title="Erase">
            {request.scheduledFor && (
              <p className="text-sm">
                Confirmed by the customer with a code. Runs on its own on{' '}
                <strong>{formatStoreDate(request.scheduledFor)}</strong>, unless they cancel it first.
                {request.resolution?.startsWith('Waiting:') && (
                  <span className="text-muted-foreground mt-1 block text-xs">{request.resolution}</span>
                )}
              </p>
            )}
            <EraseNowButton id={request.id} hasAccount={Boolean(request.customerId)} />
          </Card>
        )}

        {request.status === 'SCHEDULED' ? null : (
          <Card title={open ? 'Answer' : 'Answer given'}>
            <RequestUpdateForm
              id={request.id}
              status={request.status}
              resolution={request.resolution}
              fromAccount={request.source === 'ACCOUNT'}
            />
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
