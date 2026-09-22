import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCardIcon, KeyRoundIcon, PercentIcon, WalletIcon } from 'lucide-react';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { CommerceSettingsForm, StoreProfileForm } from '@/components/settings/SettingsForms';
import { getCurrentAdmin, requirePermission } from '@/lib/auth/requireAdmin';
import { can, formatINR } from '@StrikerStore/contract';

export const metadata: Metadata = { title: 'Settings' };

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  await requirePermission('settings:write');

  const admin = await getCurrentAdmin();
  const { store, commerce, wallet } = await (await api()).content.settings.query();

  // One line saying what the wallet is doing right now, so the card is useful
  // without opening it.
  const walletSummary = !wallet.enabled
    ? 'Switched off — customers cannot see or use it.'
    : [
        wallet.signupBonus.enabled && `${formatINR(wallet.signupBonus.amount)} signup bonus`,
        wallet.cashback.enabled &&
          wallet.cashback.slabs.length > 0 &&
          `cashback ${wallet.cashback.slabs.map((s) => `${s.percent}% above ${formatINR(s.minOrderValue)}`).join(', ')}`,
        wallet.redemption.enabled &&
          `up to ${wallet.redemption.maxPercentOfOrder}% of orders above ${formatINR(wallet.redemption.minOrderValue)}`,
      ]
        .filter(Boolean)
        .join(' · ') || 'On, but every rule is switched off.';

  // Payments sit behind their own permission, so the card is only offered to
  // someone who could actually open it — a link that 403s is worse than none.
  const canManagePayments = admin ? can(admin.role, 'payments:write') : false;

  const enabledMethods = [
    commerce.codEnabled && 'Cash on delivery',
    commerce.razorpayEnabled && 'Razorpay',
    commerce.payuEnabled && 'PayU',
    commerce.snapmintEnabled && 'Snapmint',
  ].filter(Boolean) as string[];

  return (
    <PageContainer narrow>
      <PageHeader
        title="Settings"
        subtitle="Store details, payments and the pricing rules behind every order."
      />

      <div className="flex flex-col gap-4">
        <Card title="Store details" subtitle="Printed on order slips and shown on the storefront.">
          <StoreProfileForm initial={store} />
        </Card>

        <Card
          title="Orders and pricing"
          subtitle="These decide what an order costs and how its number is built."
        >
          <CommerceSettingsForm initial={commerce} />
        </Card>

        {canManagePayments && (
          <Card
            title="Payments"
            subtitle={
              enabledMethods.length > 0
                ? `On right now: ${enabledMethods.join(', ')}.`
                : 'Nothing is switched on, so nobody can check out.'
            }
          >
            <Link
              href="/settings/payments"
              className="inline-flex w-fit items-center gap-2 font-medium hover:underline"
            >
              <CreditCardIcon className="size-4" />
              Set up Razorpay, PayU, Snapmint and cash on delivery
            </Link>
          </Card>
        )}

        <Card title="Wallet & cashback" subtitle={walletSummary}>
          <Link
            href="/settings/wallet"
            className="inline-flex w-fit items-center gap-2 font-medium hover:underline"
          >
            <WalletIcon className="size-4" />
            Set the signup bonus, cashback slabs and wallet limits
          </Link>
        </Card>

        <Card
          title="Tax"
          subtitle="The GST rates products are put on, and how they print on an invoice."
        >
          <Link
            href="/settings/tax"
            className="inline-flex w-fit items-center gap-2 font-medium hover:underline"
          >
            <PercentIcon className="size-4" />
            Manage GST rates
          </Link>
        </Card>

        <Card title="Your account" subtitle="Password and sign-in.">
          <Link
            href="/settings/account"
            className="inline-flex w-fit items-center gap-2 font-medium hover:underline"
          >
            <KeyRoundIcon className="size-4" />
            Change your password
          </Link>
        </Card>
      </div>
    </PageContainer>
  );
}
