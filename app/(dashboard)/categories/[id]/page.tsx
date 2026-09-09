import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api, serverConfig } from '@/lib/api/server';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const name = await (await api()).catalog.categoryName.query({ id });
  return { title: name ?? 'Category' };
}

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const client = await api();

  const [initial, options, { media }] = await Promise.all([
    client.catalog.categoryForm.query({ id }),
    client.catalog.categoryFormOptions.query({ excludeId: id }),
    serverConfig(),
  ]);

  if (!initial) notFound();

  return (
    <CategoryForm
      tags={options.tags}
      parentOptions={options.parents}
      initial={initial}
      ctx={media}
    />
  );
}
