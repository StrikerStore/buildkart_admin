import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { NewOrderForm } from '@/components/orders/NewOrderForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { adminMap } from '@/lib/maps';
import { api } from '@/lib/api/server';
import { DEFAULT_GST_RATES } from '@StrikerStore/contract';

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
  const map = await adminMap();

  /*
   * The shop's GST rates, for an item typed in by hand. Reading them needs
   * catalog:read, which every role that can take an order has; should that
   * ever change, the standard slabs stand in rather than the page failing.
   */
  const options = await (await api()).catalog.taxRateOptions.query().catch(() => null);
  const taxRates = options
    ? options.rates.map((rate) => ({ name: rate.name, percent: rate.percent }))
    : DEFAULT_GST_RATES.map((rate) => ({ name: rate.name, percent: rate.percent }));
  const defaultTaxPercent =
    options?.rates.find((rate) => rate.id === options.defaultRateId)?.percent ?? '0.00';

  return (
    <PageContainer>
      <PageHeader
        title="New order"
        backHref="/orders"
        backLabel="Orders"
        subtitle="For an order taken over the phone or at the counter."
      />
      <NewOrderForm map={map} taxRates={taxRates} defaultTaxPercent={defaultTaxPercent} />
    </PageContainer>
  );
}
