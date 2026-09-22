import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { WalletSettingsForm } from '@/components/settings/WalletSettingsForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Wallet & cashback' };

export default async function WalletSettingsPage() {
  await requirePermission('settings:write');

  const rules = await (await api()).content.walletRules.query();

  return (
    <PageContainer narrow>
      <PageHeader
        title="Wallet & cashback"
        backHref="/settings"
        backLabel="Settings"
        subtitle="The signup bonus, cashback slabs, and how much of an order the wallet can pay."
      />
      <WalletSettingsForm initial={rules} />
    </PageContainer>
  );
}
