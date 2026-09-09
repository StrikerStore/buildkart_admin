import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { TaxRatesForm } from '@/components/settings/TaxRatesForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Tax' };

export default async function TaxSettingsPage() {
  // Reading a rate needs only catalog:read — the product form does it — but
  // changing one reprices the catalogue, which is a settings-level act.
  await requirePermission('settings:write');

  const [rates, { store }] = await Promise.all([
    (await api()).catalog.taxRates.query(),
    (await api()).content.settings.query(),
  ]);

  return (
    <PageContainer narrow>
      <PageHeader
        title="Tax"
        backHref="/settings"
        backLabel="Settings"
        subtitle="The GST rates your products can be put on."
      />

      <div className="flex flex-col gap-4">
        <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-semibold">GST rates</h2>
            <p className="text-muted-foreground text-xs">
              Each product picks one of these, or has a rate typed in directly.
              Changing a rate here reprices every product on it — past orders keep
              what they were charged.
            </p>
          </div>

          <TaxRatesForm rates={rates} />
        </section>

        {!store.gstin && (
          <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
            {/* Without a GSTIN there is no state to compare against, so every
                supply resolves as intra-state and prints CGST + SGST. That is
                right for a local shop and wrong for an interstate one, so it is
                worth saying rather than leaving to be discovered on an invoice. */}
            No GSTIN is set in{' '}
            <a href="/settings" className="font-medium underline">
              store details
            </a>
            , so invoices will split tax as CGST + SGST for every delivery.
          </p>
        )}
      </div>
    </PageContainer>
  );
}
