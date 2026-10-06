import type { Metadata } from 'next';
import { TriangleAlertIcon } from 'lucide-react';
import { formatINR, PAYMENT_PROVIDER_LABELS } from '@StrikerStore/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { PaymentProviderForm } from '@/components/settings/PaymentProviderForm';
import { PaymentRouting } from '@/components/settings/PaymentRouting';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Payments' };

export default async function PaymentsSettingsPage() {
  // Behind its own permission, including the read: which gateway is live and in
  // which mode is configuration detail even with no credential attached.
  await requirePermission('payments:write');

  const settings = await (await api()).payments.settings.query();
  const { providers, secretsKeyConfigured, issues } = settings;

  const enabled = providers.filter((provider) => provider.enabled);
  const razorpay = providers.find((provider) => provider.provider === 'RAZORPAY');
  const razorpayWithoutWebhook =
    razorpay?.enabled && !razorpay.secrets.webhookSecret?.configured;

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
              <span className="font-medium">Credentials cannot be saved.</span> The server has no
              usable <code className="font-mono">SETTINGS_ENCRYPTION_KEY</code> — it is either unset
              or not 32 bytes of base64url, which a 32-character passphrase (24 bytes) and a hex
              string (48 bytes) both fail. Storing a gateway key in the clear is not something this
              will do. Everything else on this page still saves.
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

        {razorpayWithoutWebhook && (
          <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
            {/* Without it, a customer who pays and closes the tab before the
                modal reports back is only picked up by the 5-minute reconcile. */}
            Razorpay has no webhook secret yet. Payments still work, but an order whose customer
            closes the tab right after paying can take up to five minutes to appear.
          </p>
        )}

        {issues.length > 0 && (
          <section className="flex flex-col gap-2 rounded-lg border border-[var(--warning-fg)]/30 bg-[var(--warning-bg)] p-4">
            <h2 className="text-sm font-semibold text-[var(--warning-fg)]">
              Payments that could not become orders
            </h2>
            <p className="text-xs text-[var(--warning-fg)]">
              The customer paid, but the order could not be placed — usually because stock ran out
              while they were paying. The money is refunded automatically; a pending refund is
              retried every few minutes. Worth a call to the customer either way.
            </p>
            <ul className="flex flex-col gap-1.5 text-xs">
              {issues.map((issue) => (
                <li key={issue.sessionId} className="bg-card flex flex-wrap gap-x-3 gap-y-0.5 rounded-md px-3 py-2">
                  <span className="font-medium">{formatINR(issue.amount)}</span>
                  <span>
                    {issue.customerName ? `${issue.customerName} · ` : ''}
                    {issue.customerPhone}
                  </span>
                  <span className="text-muted-foreground">
                    {PAYMENT_PROVIDER_LABELS[issue.gateway]}
                    {issue.gatewayPaymentId ? ` · ${issue.gatewayPaymentId}` : ''}
                  </span>
                  <span
                    className={
                      issue.status === 'REFUNDED'
                        ? 'text-[var(--success-fg)]'
                        : 'text-[var(--critical-fg)]'
                    }
                  >
                    {issue.status === 'REFUNDED' ? 'Refunded' : 'Refund pending'}
                  </span>
                  {issue.reason && <span className="text-muted-foreground w-full">{issue.reason}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {settings.recentErrors.length > 0 && (
          <section className="flex flex-col gap-2 rounded-lg border border-[var(--critical-fg)]/30 bg-[var(--critical-bg)] p-4">
            <h2 className="text-sm font-semibold text-[var(--critical-fg)]">
              Checkout could not open a payment
            </h2>
            <p className="text-xs text-[var(--critical-fg)]">
              Customers saw &ldquo;We could not reach the payment gateway&rdquo;. Nothing was charged.
              The gateway&rsquo;s own words are below — use <span className="font-medium">Test connection</span>{' '}
              on its card to check a fix.
            </p>
            <ul className="flex flex-col gap-1 text-xs">
              {settings.recentErrors.map((entry) => (
                <li key={entry.at} className="bg-card flex flex-wrap gap-x-3 rounded-md px-3 py-1.5">
                  <span className="font-medium">{PAYMENT_PROVIDER_LABELS[entry.gateway]}</span>
                  <span>{entry.reason}</span>
                  <span className="text-muted-foreground ml-auto">
                    {new Date(entry.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <PaymentRouting settings={settings} />

        {providers.map((provider) => (
          <PaymentProviderForm
            key={provider.provider}
            provider={provider}
            secretsKeyConfigured={secretsKeyConfigured}
          />
        ))}

        <p className="text-muted-foreground text-xs">
          {/* Said plainly, so nobody switches Snapmint on expecting it to appear. */}
          Online orders are placed only once the gateway confirms the money, and show as Paid.
          Snapmint is stored but not offered at checkout yet.
        </p>
      </div>
    </PageContainer>
  );
}
