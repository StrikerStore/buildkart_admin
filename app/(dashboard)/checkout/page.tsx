import type { Metadata } from 'next';
import Link from 'next/link';
import { TriangleAlertIcon } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlowForm } from '@/components/checkout/FlowForm';
import { FieldsEditor } from '@/components/checkout/FieldsEditor';
import { ContentForm } from '@/components/checkout/ContentForm';
import { DesignForm } from '@/components/checkout/DesignForm';
import { LocationForm } from '@/components/checkout/LocationForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api, serverConfig } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  await requirePermission('settings:write');

  const client = await api();
  const [config, payments, taxRates, { media }] = await Promise.all([
    client.content.checkoutConfig.query(),
    client.payments.checkoutMethods.query(),
    client.catalog.taxRates.query(),
    serverConfig(),
  ]);

  // Only worth offering the GST toggle honestly: nothing is taxed until a rate
  // is actually on a product, and `productCount` is what says so.
  const hasTax = taxRates.some((rate) => rate.productCount > 0);

  return (
    <PageContainer>
      <PageHeader
        title="Checkout"
        subtitle="How the last screen of the shop behaves, what it asks for and what it says."
      />

      <div className="flex flex-col gap-4">
        {/*
          Said plainly and once, at the top. Everything below saves and is
          stored — but nothing renders it yet, and someone configuring a pay
          button should not have to discover that by looking for it.
        */}
        <p className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
          The storefront checkout is not built yet. Everything here is saved and
          will be read by it when it is.
        </p>

        {payments.length === 0 && (
          <p className="flex items-start gap-2 rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
            <TriangleAlertIcon className="mt-px size-4 shrink-0" />
            <span>
              No payment method is switched on, so this checkout could not take an
              order.{' '}
              <Link href="/settings/payments" className="font-medium underline">
                Set one up
              </Link>
              .
            </span>
          </p>
        )}

        <Tabs defaultValue="flow">
          <TabsList>
            <TabsTrigger value="flow">Flow</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="content">Wording</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
          </TabsList>

          {/* Each tab saves on its own, so an unfinished step order cannot
              block a wording change. */}
          <TabsContent value="flow">
            <FlowForm initial={config.flow} />
          </TabsContent>
          <TabsContent value="fields">
            <FieldsEditor initial={config.fields} />
          </TabsContent>
          <TabsContent value="location">
            <LocationForm
              initial={config.location}
              secretsKeyConfigured={config.secretsKeyConfigured}
            />
          </TabsContent>
          <TabsContent value="content">
            <ContentForm initial={config.content} />
          </TabsContent>
          <TabsContent value="design">
            <DesignForm
              initial={config.design}
              badgeImages={config.trustBadgeImages}
              ctx={media}
              hasTax={hasTax}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
