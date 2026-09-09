import type { Metadata } from 'next';
import Link from 'next/link';

import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { ImportUploader } from '@/components/imports/ImportUploader';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { api, serverConfig } from '@/lib/api/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Import products' };

const STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'Uploaded',
  PARSING: 'Reading',
  DRY_RUN_READY: 'Awaiting review',
  COMMITTING: 'Importing',
  IMPORTING_IMAGES: 'Fetching images',
  COMPLETED: 'Finished',
  FAILED: 'Failed',
  CANCELLED: 'Discarded',
};

export default async function ImportPage() {
  await requireAdmin();
  const [jobs, config] = await Promise.all([
    (await api()).operations.importJobs.query(),
    serverConfig(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Import products"
        subtitle="Load a Shopify product CSV. Products are matched by Handle, so re-importing updates rather than duplicates."
        backHref="/products"
        backLabel="Products"
      />

      <div className="flex flex-col gap-5">
        <ImportUploader configured={config.r2Configured} />

        {jobs.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Recent imports</h2>
            <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
              {jobs.map((job) => (
                <li key={job.id} className="border-b last:border-b-0">
                  <Link
                    href={`/products/import/${job.id}`}
                    className="hover:bg-muted/40 flex items-center gap-3 px-3 py-2.5 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{job.filename}</span>
                      <span className="text-muted-foreground block text-xs">
                        {new Date(job.createdAt).toLocaleString('en-GB')}
                      </span>
                    </span>

                    <span className="text-muted-foreground tabular hidden shrink-0 text-xs sm:block">
                      {job.totalProducts} product{job.totalProducts === 1 ? '' : 's'}
                    </span>

                    {job.errorCount > 0 && (
                      <span className="shrink-0 rounded-full bg-[var(--critical-bg)] px-2 py-0.5 text-xs font-medium text-[var(--critical-fg)]">
                        {job.errorCount} error{job.errorCount === 1 ? '' : 's'}
                      </span>
                    )}

                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                        job.status === 'COMPLETED'
                          ? 'bg-[var(--success-bg)] text-[var(--success-fg)]'
                          : job.status === 'FAILED'
                            ? 'bg-[var(--critical-bg)] text-[var(--critical-fg)]'
                            : 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)]',
                      )}
                    >
                      {STATUS_LABELS[job.status] ?? job.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
