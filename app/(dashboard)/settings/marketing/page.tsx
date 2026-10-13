import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { MetaMarketingForm, MarketingEventsLog, AttributionSummary } from '@/components/settings/MetaMarketing';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Marketing' };

export default async function MarketingSettingsPage() {
  await requirePermission('settings:write');

  const meta = await (await api()).marketing.meta.query();

  return (
    <PageContainer narrow>
      <PageHeader
        title="Marketing"
        backHref="/settings"
        backLabel="Settings"
        subtitle="Meta ads: sales reported from the server, and where each order came from."
      />

      <div className="flex flex-col gap-4">
        <MetaMarketingForm data={meta} />
        <AttributionSummary data={meta.attribution} />
        <MarketingEventsLog events={meta.recentEvents} />
      </div>
    </PageContainer>
  );
}
