import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageForm } from '@/components/content/PageForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api, serverConfig } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const page = await (await api()).content.page.query({ id });
  return { title: page?.titleEn ?? 'Page' };
}

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('content:write');

  const { id } = await params;
  const [page, { media }] = await Promise.all([
    (await api()).content.page.query({ id }),
    serverConfig(),
  ]);

  if (!page) notFound();

  return <PageForm initial={page} ctx={media} />;
}
