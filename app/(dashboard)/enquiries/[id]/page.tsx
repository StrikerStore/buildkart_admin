import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageCircleIcon, PhoneIcon } from 'lucide-react';
import { ENQUIRY_KIND_LABELS, formatStoreDateTimeShort } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { EnquiryForm } from '@/components/enquiries/EnquiryForm';
import { QuoteSnapshotTable } from '@/components/enquiries/QuoteSnapshotTable';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const enquiry = await (await api()).enquiries.detail.query({ id });
  return { title: enquiry ? `${enquiry.enquiryNumber} · Enquiries` : 'Enquiries' };
}

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('support:read');

  const { id } = await params;
  const enquiry = await (await api()).enquiries.detail.query({ id });
  if (!enquiry) notFound();

  return (
    <PageContainer narrow>
      <PageHeader
        title={enquiry.enquiryNumber}
        subtitle={`${ENQUIRY_KIND_LABELS[enquiry.kind]} · ${formatStoreDateTimeShort(enquiry.createdAt)}`}
      />

      <div className="flex flex-col gap-4">
        <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
          <div>
            <h2 className="font-semibold">{enquiry.name}</h2>
            <p className="text-muted-foreground tabular text-xs">+91 {enquiry.phone}</p>
            {/* Typed into a public form, so it may not be theirs. Worth saying
                before someone rings a stranger about cement. */}
            <p className="text-muted-foreground mt-1 text-xs">
              {enquiry.customerId ? (
                <>
                  Sent while signed in.{' '}
                  <Link href={`/customers/${enquiry.customerId}`} className="underline">
                    Open their account
                  </Link>
                </>
              ) : (
                'Sent without signing in, so this number has not been verified.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`tel:+91${enquiry.phone}`}>
                <PhoneIcon className="size-4" />
                Call
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`https://wa.me/91${enquiry.phone}`} target="_blank" rel="noreferrer">
                <MessageCircleIcon className="size-4" />
                WhatsApp
              </a>
            </Button>
          </div>

          {enquiry.message && (
            <p className="bg-muted/40 rounded-md border p-3 whitespace-pre-wrap">{enquiry.message}</p>
          )}
        </section>

        {enquiry.quote && <QuoteSnapshotTable quote={enquiry.quote} />}

        <EnquiryForm id={enquiry.id} status={enquiry.status} note={enquiry.note ?? ''} />
      </div>
    </PageContainer>
  );
}
