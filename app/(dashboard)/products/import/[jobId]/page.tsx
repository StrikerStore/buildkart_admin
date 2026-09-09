import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { ImportPreview } from '@/components/imports/ImportPreview';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Import' };

export default async function ImportJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  await requireAdmin();
  const { jobId } = await params;

  const data = await (await api()).operations.importJob.query({ jobId });
  if (!data) notFound();

  const { job, issues } = data;

  return (
    <PageContainer>
      <PageHeader
        title={job.filename}
        subtitle="Nothing is written until you commit."
        backHref="/products/import"
        backLabel="Imports"
      />

      <ImportPreview job={job} issues={issues} />
    </PageContainer>
  );
}
