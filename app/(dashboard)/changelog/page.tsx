import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronRightIcon, HistoryIcon } from 'lucide-react';
import { auditListQuerySchema } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { AuditFilters } from '@/components/changelog/AuditFilters';
import { AuditTable } from '@/components/changelog/AuditTable';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Change log' };

const text = (value: string | string[] | undefined) =>
  typeof value === 'string' && value !== '' ? value : undefined;

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The only screen in the admin that reads the trail, and the trail is exactly
  // what a staff account must not be able to inspect or quietly rely on.
  await requirePermission('audit:read');

  const raw = await searchParams;
  const parsed = auditListQuerySchema.safeParse({
    q: text(raw.q),
    group: text(raw.group),
    entityType: text(raw.entityType),
    adminUserId: text(raw.adminUserId),
    from: text(raw.from),
    to: text(raw.to),
    cursor: text(raw.cursor),
  });
  // A hand-edited URL degrades to the unfiltered log rather than an error page:
  // this is the screen you reach for when something is already broken.
  const query = parsed.success ? parsed.data : auditListQuerySchema.parse({});

  const client = await api();
  const [{ entries, nextCursor }, options] = await Promise.all([
    client.operations.auditLog.query(query),
    client.operations.auditFilterOptions.query(),
  ]);

  const nextHref = (cursor: string) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({
      q: query.q,
      group: query.group,
      entityType: query.entityType,
      adminUserId: query.adminUserId,
      from: query.from,
      to: query.to,
    })) {
      if (value) next.set(key, value);
    }
    next.set('cursor', cursor);
    return `/changelog?${next}`;
  };

  const isFiltered = Boolean(
    query.q || query.group || query.entityType || query.adminUserId || query.from || query.to,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Change log"
        subtitle="Every change made in the admin, newest first. Written automatically — nothing here can be edited."
      />

      <div className="flex flex-col gap-4">
        {/* useSearchParams needs a Suspense boundary, or the whole route opts
            out of static optimisation and renders entirely on the client. */}
        <Suspense fallback={<div className="h-9" />}>
          <AuditFilters
            admins={options.admins}
            groups={options.groups}
            entityTypes={options.entityTypes}
          />
        </Suspense>

        {entries.length === 0 ? (
          <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
            <HistoryIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
            <p className="font-medium">
              {isFiltered ? 'Nothing matches these filters' : 'Nothing has been changed yet'}
            </p>
            <p className="text-muted-foreground max-w-[420px]">
              {isFiltered
                ? 'Try a wider date range, or clear a filter.'
                : 'Every edit made in the admin lands here as soon as it is saved.'}
            </p>
          </div>
        ) : (
          <AuditTable entries={entries} />
        )}

        {nextCursor && (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href={nextHref(nextCursor)}>
                Older
                <ChevronRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
