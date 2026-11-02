import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon } from 'lucide-react';
import {
  ENQUIRY_KIND_LABELS,
  ENQUIRY_STATUS_LABELS,
  enquiryInboxQuerySchema,
  formatStoreDateTimeShort,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { EnquiryFilters } from '@/components/enquiries/EnquiryFilters';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Enquiries' };

/**
 * Messages from the website's Contact us form, and requests for a better rate.
 *
 * Opens on **New**, like Support opens on Awaiting reply: this is a work queue,
 * and the question it answers is who still needs a call back.
 */
export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('support:read');

  const raw = await searchParams;
  const parsed = enquiryInboxQuerySchema.safeParse({
    q: typeof raw.q === 'string' ? raw.q : undefined,
    filter: typeof raw.filter === 'string' ? raw.filter : undefined,
    page: typeof raw.page === 'string' ? raw.page : undefined,
  });
  const query = parsed.success ? parsed.data : enquiryInboxQuerySchema.parse({});

  const { enquiries, totalPages, newCount } = await (await api()).enquiries.list.query(query);

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (query.q) next.set('q', query.q);
    if (query.filter !== 'NEW') next.set('filter', query.filter);
    if (page > 1) next.set('page', String(page));
    return `/enquiries${next.toString() ? `?${next}` : ''}`;
  };

  return (
    <PageContainer>
      <PageHeader
        title="Enquiries"
        subtitle={
          newCount > 0
            ? `${newCount} ${newCount === 1 ? 'person needs' : 'people need'} a call back`
            : 'Nobody is waiting. Messages from the website land here.'
        }
      />

      <div className="flex flex-col gap-4">
        {/* useSearchParams needs a Suspense boundary, or the whole route opts
            out of static optimisation and renders entirely on the client. */}
        <Suspense fallback={<div className="h-[84px]" />}>
          <EnquiryFilters newCount={newCount} />
        </Suspense>

        {enquiries.length === 0 ? (
          <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-4 py-12 text-center shadow-[var(--shadow-card)]">
            <InboxIcon className="text-muted-foreground size-6" />
            <p className="font-medium">{query.q ? 'Nothing matches that search' : 'Nothing here'}</p>
            <p className="text-muted-foreground text-xs">
              {query.q
                ? 'Try a different name, phone or enquiry number.'
                : 'Contact us messages and rate requests from the website appear in this list.'}
            </p>
          </div>
        ) : (
          <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
            <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium md:flex">
              <span className="w-[92px] shrink-0">Enquiry</span>
              <span className="min-w-0 flex-1">From</span>
              <span className="w-[110px] shrink-0">Type</span>
              <span className="w-[90px] shrink-0">Status</span>
              <span className="w-[150px] shrink-0 text-right">Received</span>
            </div>

            <ul>
              {enquiries.map((enquiry) => (
                <li key={enquiry.id} className="border-b last:border-b-0">
                  <Link
                    href={`/enquiries/${enquiry.id}`}
                    className="hover:bg-muted/40 flex flex-col gap-1 px-3 py-2.5 transition-colors md:flex-row md:items-center md:gap-3"
                  >
                    <span className="tabular w-[92px] shrink-0 text-xs font-medium">
                      {enquiry.enquiryNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{enquiry.name}</span>
                        <span className="text-muted-foreground tabular shrink-0 text-xs">
                          {enquiry.phone}
                        </span>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {enquiry.preview}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs md:w-[110px]">
                      {ENQUIRY_KIND_LABELS[enquiry.kind]}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs md:w-[90px]">
                      {ENQUIRY_STATUS_LABELS[enquiry.status]}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs md:w-[150px] md:text-right">
                      {formatStoreDateTimeShort(enquiry.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Page {query.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" disabled={query.page <= 1}>
                <Link href={pageHref(query.page - 1)}>
                  <ChevronLeftIcon className="size-4" />
                  Previous
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" disabled={query.page >= totalPages}>
                <Link href={pageHref(query.page + 1)}>
                  Next
                  <ChevronRightIcon className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
