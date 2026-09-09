import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api/server';
import { TagForm } from '@/components/tags/TagForm';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const name = await (await api()).catalog.tagName.query({ id });
  return { title: name ?? 'Tag' };
}

export default async function EditTagPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const data = await (await api()).catalog.tagForm.query({ id });
  if (!data) notFound();

  return <TagForm otherTags={data.otherTags} initial={data.initial} />;
}
