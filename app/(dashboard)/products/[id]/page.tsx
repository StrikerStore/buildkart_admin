import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api/server';
import { ProductForm } from '@/components/products/ProductForm';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const name = await (await api()).catalog.productName.query({ id });
  return { title: name ?? 'Product' };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const client = await api();

  const [initial, options] = await Promise.all([
    client.catalog.productForm.query({ id }),
    client.catalog.productFormOptions.query(),
  ]);

  if (!initial) notFound();

  // Keyed on the save time, so a save remounts the form from what was stored
  // (new variant ids, the new starting stock) rather than from what was typed.
  return <ProductForm key={initial.updatedAt ?? initial.id} {...options} initial={initial} />;
}
