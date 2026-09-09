import type { Metadata } from 'next';
import { PageForm } from '@/components/content/PageForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { serverConfig } from '@/lib/api/server';

export const metadata: Metadata = { title: 'New page' };

export default async function NewPagePage() {
  await requirePermission('content:write');
  const { media } = await serverConfig();

  return (
    <PageForm
      ctx={media}
      initial={{
        id: null,
        slug: '',
        kind: 'STANDARD',
        titleEn: '',
        titleHi: '',
        bodyHtmlEn: '',
        bodyHtmlHi: '',
        seoTitle: '',
        seoDescription: '',
        isPublished: false,
      }}
    />
  );
}
