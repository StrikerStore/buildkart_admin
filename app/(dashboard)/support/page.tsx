import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon, LifeBuoyIcon, MessagesSquareIcon } from 'lucide-react';
import {
  formatStoreDateTimeShort,
  supportInboxQuerySchema,
  supportTopicLabel,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { SupportFilters } from '@/components/support/SupportFilters';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Support' };

/**
 * The inbox.
 *
 * Opens on **Awaiting reply** rather than on everything, because unlike every
 * other index screen in the admin this one is a work queue: the question it
 * answers is "who is waiting", and a default that buries three unanswered
 * people under forty resolved threads answers a different one.
 */
export default async function SupportInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('support:read');

  const raw = await searchParams;
  const parsed = supportInboxQuerySchema.safeParse({
    q: typeof raw.q === 'string' ? raw.q : undefined,
    filter: typeof raw.filter === 'string' ? raw.filter : undefined,
    page: typeof raw.page === 'string' ? raw.page : undefined,
  });
  const query = parsed.success ? parsed.data : supportInboxQuerySchema.parse({});

  const { tickets, totalPages, awaitingCount } = await (await api()).support.list.query(query);

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (query.q) next.set('q', query.q);
    if (query.filter !== 'awaiting') next.set('filter', query.filter);
    if (page > 1) next.set('page', String(page));
    return `/support${next.toString() ? `?${next}` : ''}`;
  };

  const isSearching = Boolean(query.q);

  return (
    <PageContainer>
      <PageHeader
        title="Support"
        subtitle={
          awaitingCount > 0
            ? `${awaitingCount} ${awaitingCount === 1 ? 'person is' : 'people are'} waiting on a reply`
            : 'Nobody is waiting. Conversations from the website land here.'
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/support/replies">Saved replies</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        {/* useSearchParams needs a Suspense boundary, or the whole route opts
            out of static optimisation and renders entirely on the client. */}
        <Suspense fallback={<div className="h-[84px]" />}>
          <SupportFilters awaitingCount={awaitingCount} />
        </Suspense>

        {tickets.length === 0 ? (
          <EmptyInbox filter={query.filter} isSearching={isSearching} />
        ) : (
          <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
            <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium md:flex">
              <span className="w-[92px] shrink-0">Ticket</span>
              <span className="min-w-0 flex-1">Conversation</span>
              <span className="w-[130px] shrink-0">Topic</span>
              <span className="w-[150px] shrink-0 text-right">Last message</span>
            </div>

            <ul>
              {tickets.map((ticket) => (
                <li key={ticket.id} className="border-b last:border-b-0">
                  <Link
                    href={`/support/${ticket.id}`}
                    className="hover:bg-muted/40 flex flex-col gap-1 px-3 py-2.5 transition-colors md:flex-row md:items-center md:gap-3"
                  >
                    <span className="tabular w-[92px] shrink-0 text-xs font-medium">
                      {ticket.ticketNumber}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">
                          {ticket.customerName ?? ticket.customerPhone}
                        </span>
                        {ticket.awaitingReply && (
                          <span className="shrink-0 rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--warning-fg)]">
                            Awaiting reply
                          </span>
                        )}
                        {ticket.status === 'RESOLVED' && (
                          <span className="text-muted-foreground bg-muted shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                            Resolved
                          </span>
                        )}
                        {ticket.orderNumber && (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {ticket.orderNumber}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {/* Whose words these are matters as much as what they
                            say — "we have dispatched it" reads very differently
                            depending on who said it last. */}
                        {ticket.lastMessageFrom === 'ADMIN' && 'You: '}
                        {ticket.preview}
                      </span>
                    </span>

                    <span className="text-muted-foreground shrink-0 text-xs md:w-[130px]">
                      {supportTopicLabel(ticket.topic, 'en')}
                    </span>

                    <span className="text-muted-foreground shrink-0 text-right text-xs md:w-[150px]">
                      {formatStoreDateTimeShort(ticket.lastMessageAt)}
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

/**
 * Three different nothings.
 *
 * An empty queue is good news and should read like it; an empty search is a
 * dead end to back out of; an empty "all" means the feature has never been
 * used. One message for all three would be wrong twice.
 */
function EmptyInbox({ filter, isSearching }: { filter: string; isSearching: boolean }) {
  const Icon = filter === 'awaiting' && !isSearching ? MessagesSquareIcon : LifeBuoyIcon;

  const [heading, body] = isSearching
    ? ['Nothing matches that search', 'Try a ticket number, an order number, or a phone number.']
    : filter === 'awaiting'
      ? ['You are all caught up', 'Every conversation has been answered. New ones appear here.']
      : filter === 'resolved'
        ? ['Nothing resolved yet', 'Conversations you close appear here.']
        : [
            'No conversations yet',
            'Customers start these from the website footer, or from an order they are tracking.',
          ];

  return (
    <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
      <Icon className="text-muted-foreground size-8" strokeWidth={1.5} />
      <p className="font-medium">{heading}</p>
      <p className="text-muted-foreground max-w-[420px]">{body}</p>
    </div>
  );
}
