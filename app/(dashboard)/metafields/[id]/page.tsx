import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api/server';
import { MetafieldDefinitionForm } from '@/components/metafields/MetafieldDefinitionForm';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const name = await (await api()).catalog.metafieldName.query({ id });
  return { title: name ?? 'Custom field' };
}

export default async function EditMetafieldPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const initial = await (await api()).catalog.metafieldForm.query({ id });
  if (!initial) notFound();

  return <MetafieldDefinitionForm initial={initial} />;
}
