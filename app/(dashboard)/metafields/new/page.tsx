import type { Metadata } from 'next';
import { emptyMetafieldDefinitionForm } from '@StrikerStore/contract';
import { MetafieldDefinitionForm } from '@/components/metafields/MetafieldDefinitionForm';
import { requirePermission } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'New custom field' };

export default async function NewMetafieldPage() {
  await requirePermission('catalog:write');

  return <MetafieldDefinitionForm initial={emptyMetafieldDefinitionForm()} />;
}
