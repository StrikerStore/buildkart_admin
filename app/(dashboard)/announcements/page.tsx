import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { AnnouncementBarForm } from '@/components/content/AnnouncementBarForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Announcement bar' };

export default async function AnnouncementsPage() {
  await requirePermission('content:write');

  const bar = await (await api()).content.announcementBar.query();

  return (
    <PageContainer narrow>
      <PageHeader
        title="Announcement bar"
        subtitle="The thin strip above the header, on every page. More than one message and they take turns."
      />
      <AnnouncementBarForm initial={bar} />
    </PageContainer>
  );
}
