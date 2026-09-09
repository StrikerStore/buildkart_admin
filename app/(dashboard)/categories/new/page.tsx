import type { Metadata } from 'next';
import { emptyCategoryForm } from '@StrikerStore/contract';
import { api, serverConfig } from '@/lib/api/server';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'New category' };

export default async function NewCategoryPage() {
  await requireAdmin();
  const [options, { media }] = await Promise.all([
    (await api()).catalog.categoryFormOptions.query({}),
    serverConfig(),
  ]);

  return (
    <CategoryForm
      tags={options.tags}
      parentOptions={options.parents}
      initial={emptyCategoryForm()}
      ctx={media}
    />
  );
}
