import type { Metadata } from 'next';
import { emptyProductForm } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';
import { ProductForm } from '@/components/products/ProductForm';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  await requireAdmin();
  const options = await (await api()).catalog.productFormOptions.query();

  return <ProductForm {...options} initial={emptyProductForm()} />;
}
