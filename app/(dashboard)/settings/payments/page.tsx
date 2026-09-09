import type { Metadata } from 'next';
import { TriangleAlertIcon } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { PaymentProviderForm } from '@/components/settings/PaymentProviderForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Payments' };

export default async function PaymentsSettingsPage() {
  // Behind its own permission, including the read: which gateway is live and in
  // which mode is configuration detail even with no credential attached.
  await requirePermission('payments:write');

  const { providers, secretsKeyConfigured } = await (await api()).payments.settings.query();

  const enabled = providers.filter((provider) => provider.enabled);

  return (
    <PageContainer narrow>
      <PageHeader
        title="Payments"
        backHref="/settings"
        backLabel="Settings"
        subtitle="Which methods a customer can pay with, and the credentials behind them."
      />

      <div className="flex flex-col gap-4">
        {!secretsKeyConfigured && (
          <div className="flex items-start gap-2.5 rounded-md bg-[var(--warning-bg)] px-3 py-2.5 text-xs text-[var(--warning-fg)]">
            <TriangleAlertIcon className="mt-px size-4 shrink-0" />
            <p>
              <span className="font-medium">Credentials cannot be saved.</span> The server has no{' '}
              <code className="font-mono">SETTINGS_ENCRYPTION_KEY</code>, and storing a gateway key
              in the clear is not something this will do. Everything else on this page still saves.
            </p>
          </div>
        )}

        {enabled.length === 0 && (
          <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
            {/* Deliberately allowed — the shop may be pausing — but it stops
                checkout dead, so it must not happen unnoticed. */}
            With every method off, nobody will be able to check out.
          </p>
        )}

        {providers.map((provider) => (
          <PaymentProviderForm
            key={provider.provider}
            provider={provider}
            secretsKeyConfigured={secretsKeyConfigured}
          />
        ))}

        <p className="text-muted-foreground text-xs">
          {/* Said plainly, because the alternative is someone entering live keys
              and wondering why nothing happens on the storefront. */}
          These settings are stored and ready. Taking payments needs the storefront
          checkout, which is not built yet — until then, a payment is recorded by
          hand on the order.
        </p>
      </div>
    </PageContainer>
  );
}
