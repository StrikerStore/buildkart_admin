import type { Metadata } from 'next';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from '@StrikerStore/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventMatrix } from '@/components/notifications/EventMatrix';
import { MessageLog } from '@/components/notifications/MessageLog';
import { ProviderForms } from '@/components/notifications/ProviderForms';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Customer messages' };

export default async function NotificationsPage() {
  await requirePermission('settings:write');

  const client = await api();
  const [{ templates, providers, activeWithoutProvider }, log] = await Promise.all([
    client.notifications.page.query(),
    client.notifications.messages.query({ limit: 100 }),
  ]);

  const enabledChannels = NOTIFICATION_CHANNELS.filter((channel) =>
    channel === 'SMS'
      ? providers.sms.enabled
      : channel === 'WHATSAPP'
        ? providers.whatsapp.enabled
        : providers.email.enabled,
  ) as NotificationChannel[];

  const live = templates.filter((template) => template.isActive).length;
  const liveWhatsapp = templates.filter(
    (template) => template.isActive && template.channel === 'WHATSAPP',
  ).length;
  const whatsappSending = providers.whatsapp.enabled && providers.whatsapp.provider === 'AISENSY';

  return (
    <PageContainer>
      <PageHeader
        title="Customer messages"
        subtitle="What the shop tells a customer, and when."
      />

      <div className="flex flex-col gap-4">
        {/*
          Said once, at the top. Someone writing twelve messages should know
          before the first one which of them will actually reach a phone.
        */}
        <p className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
          {whatsappSending
            ? `WhatsApp is live through AiSensy: ${liveWhatsapp} message${liveWhatsapp === 1 ? ' is' : 's are'} switched on, and each sends once WhatsApp has approved its template.`
            : 'WhatsApp is not switched on, so nothing is sent yet.'}{' '}
          SMS and email are stored but not sent.{' '}
          {live === 0
            ? 'No messages are switched on.'
            : `${live} ${live === 1 ? 'is' : 'are'} switched on in total.`}
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
            <TabsTrigger value="log">Sent</TabsTrigger>
          </TabsList>

          <TabsContent value="messages">
            <EventMatrix templates={templates} enabledChannels={enabledChannels} />
          </TabsContent>
          <TabsContent value="providers">
            <ProviderForms providers={providers} />
          </TabsContent>
          <TabsContent value="log">
            <MessageLog messages={log.messages} />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
