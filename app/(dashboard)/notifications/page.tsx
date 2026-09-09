import type { Metadata } from 'next';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from '@buildkart/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventMatrix } from '@/components/notifications/EventMatrix';
import { ProviderForms } from '@/components/notifications/ProviderForms';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Customer messages' };

export default async function NotificationsPage() {
  await requirePermission('settings:write');

  const { templates, providers, activeWithoutProvider } = await (
    await api()
  ).notifications.page.query();

  const enabledChannels = NOTIFICATION_CHANNELS.filter((channel) =>
    channel === 'SMS'
      ? providers.sms.enabled
      : channel === 'WHATSAPP'
        ? providers.whatsapp.enabled
        : providers.email.enabled,
  ) as NotificationChannel[];

  const live = templates.filter((template) => template.isActive).length;

  return (
    <PageContainer>
      <PageHeader
        title="Customer messages"
        subtitle="What the shop tells a customer, and when."
      />

      <div className="flex flex-col gap-4">
        {/*
          Said once, at the top, and repeated on the providers tab. Someone
          writing twelve messages should know before the first one that nothing
          is being sent yet — not discover it afterwards.
        */}
        <p className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
          Nothing is sent yet. These are written and stored now so the wording and
          the DLT registrations are settled before a provider is connected —
          {' '}
          {live === 0
            ? 'none are switched on.'
            : `${live} ${live === 1 ? 'is' : 'are'} switched on and ready.`}
        </p>

        {activeWithoutProvider > 0 && (
          <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
            {activeWithoutProvider} message{activeWithoutProvider === 1 ? ' is' : 's are'}{' '}
            switched on for a channel with no provider behind it. That is fine while you
            get the wording approved — they simply will not go anywhere.
          </p>
        )}

        <Tabs defaultValue="messages">
          <TabsList>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
          </TabsList>

          <TabsContent value="messages">
            <EventMatrix templates={templates} enabledChannels={enabledChannels} />
          </TabsContent>
          <TabsContent value="providers">
            <ProviderForms providers={providers} />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
