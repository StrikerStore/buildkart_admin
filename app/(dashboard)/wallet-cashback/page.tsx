import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { WalletSettingsForm } from '@/components/settings/WalletSettingsForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Wallet & cashback' };

/**
 * The wallet rules, under Discounts.
 *
 * Cashback and the signup bonus are promotions — they sit beside coupons, and
 * take the same `discounts:write` permission, rather than among the store's
 * configuration in Settings where they started.
 */
export default async function WalletCashbackPage() {
  await requirePermission('discounts:write');

  const rules = await (await api()).content.walletRules.query();

  return (
    <PageContainer narrow>
      <PageHeader
        title="Wallet & cashback"
        subtitle="The signup bonus, cashback slabs, and how much of an order the wallet can pay."
      />
      <WalletSettingsForm initial={rules} />
    </PageContainer>
  );
}
