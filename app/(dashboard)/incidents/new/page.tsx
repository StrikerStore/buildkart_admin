import type { Metadata } from 'next';
import { toStoreInputValue } from '@StrikerStore/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { IncidentForm } from '@/components/privacy/IncidentForm';
import { requirePermission } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Record a breach' };

export default async function NewIncidentPage() {
  await requirePermission('privacy:manage');

  return (
    <PageContainer narrow>
      <PageHeader
        title="Record a breach"
        subtitle="Write it down now, even with gaps — you can change every field later. The Board's 72 hours have already started."
        backHref="/incidents"
        backLabel="Incidents"
      />
      <IncidentForm incident={null} now={toStoreInputValue(new Date())} />
    </PageContainer>
  );
}
