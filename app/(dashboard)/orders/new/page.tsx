import type { Metadata } from 'next';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { NewOrderForm } from '@/components/orders/NewOrderForm';
import { requirePermission } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'New order' };

/**
 * Taking an order by hand.
 *
 * Contractors ring the shop, and someone walks in at the counter. Without this
 * those orders live on a paper pad, outside stock, outside the day's takings
 * and outside the delivery run — which is worse than not having the screen.
 */
export default async function NewOrderPage() {
  await requirePermission('orders:write');

  const { commerce } = await (await api()).content.settings.query();

  return (
    <PageContainer>
      <PageHeader
        title="New order"
        backHref="/orders"
        backLabel="Orders"
        subtitle="For an order taken over the phone or at the counter."
      />
      <NewOrderForm bulkCutoff={commerce.bulkUnlockCutoff} />
    </PageContainer>
  );
}
