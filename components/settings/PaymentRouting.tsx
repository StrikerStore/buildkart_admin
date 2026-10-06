'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { PaymentProvider, PaymentSettingsDto } from '@StrikerStore/contract';
import { PAYMENT_PROVIDER_LABELS } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { reorderPaymentProviders } from '@/app/(dashboard)/settings/payments/actions';

const ONLINE: PaymentProvider[] = ['RAZORPAY', 'PAYU'];

/**
 * Which gateway takes the money.
 *
 * "Pay ₹X" opens the top switched-on gateway, and the customer chooses UPI, a
 * card or anything else inside its own window. If that gateway will not open a
 * payment, the next one down takes over — so the order here is the whole of
 * the routing.
 */
export function PaymentRouting({ settings }: { settings: PaymentSettingsDto }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();

  const ordered = settings.providers.map((provider) => provider.provider);
  const [online, setOnline] = useState(ordered.filter((provider) => ONLINE.includes(provider)));

  function move(index: number, by: -1 | 1) {
    const next = [...online];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved!);
    setOnline(next);

    startSaving(async () => {
      // The online gateways first, in their new order; everything else keeps
      // its place after them. Only the online order affects routing.
      const result = await reorderPaymentProviders({
        providers: [...next, ...ordered.filter((provider) => !ONLINE.includes(provider))],
      });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not save the priority.');
        setOnline(online);
        return;
      }
      toast.success('Priority saved');
      router.refresh();
    });
  }

  const enabled = new Set(
    settings.providers.filter((provider) => provider.enabled).map((provider) => provider.provider),
  );

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">Gateway priority</h2>
        <p className="text-muted-foreground text-xs">
          &ldquo;Pay&rdquo; at checkout opens the top gateway that is switched on; the customer picks UPI,
          a card or anything else inside it. If it fails to open, the next one takes over.
        </p>
      </div>

      <ol className="flex flex-col gap-2">
        {online.map((provider, index) => (
          <li
            key={provider}
            className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <span className="text-muted-foreground tabular w-4 text-xs">{index + 1}</span>
            <span className="flex-1 font-medium">
              {PAYMENT_PROVIDER_LABELS[provider]}
              {!enabled.has(provider) && (
                <span className="text-muted-foreground ml-2 text-xs font-normal">Off</span>
              )}
            </span>
            {isSaving && index === 0 && <LoaderCircleIcon className="size-4 animate-spin" />}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={index === 0 || isSaving}
              onClick={() => move(index, -1)}
            >
              <ArrowUpIcon className="size-4" />
              <span className="sr-only">Move {PAYMENT_PROVIDER_LABELS[provider]} up</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={index === online.length - 1 || isSaving}
              onClick={() => move(index, 1)}
            >
              <ArrowDownIcon className="size-4" />
              <span className="sr-only">Move {PAYMENT_PROVIDER_LABELS[provider]} down</span>
            </Button>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium">Webhooks</h3>
        {settings.webhookUrls ? (
          <>
            <p className="text-muted-foreground text-xs">
              Paste these into each gateway’s dashboard. They place the order even when a
              customer closes the tab before returning. For Razorpay, choose the events{' '}
              <code className="font-mono">payment.captured</code>,{' '}
              <code className="font-mono">payment.failed</code> and{' '}
              <code className="font-mono">order.paid</code>, and save the webhook secret it shows
              you on the Razorpay card below.
            </p>
            {ONLINE.map((provider) => (
              <WebhookUrl
                key={provider}
                label={PAYMENT_PROVIDER_LABELS[provider]}
                url={settings.webhookUrls![provider as 'RAZORPAY' | 'PAYU']}
              />
            ))}
          </>
        ) : (
          <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
            Set <code className="font-mono">API_PUBLIC_URL</code> on the API server to see the
            webhook addresses to give Razorpay and PayU.
          </p>
        )}
      </div>
    </section>
  );
}

function WebhookUrl({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-16 shrink-0">{label}</span>
      <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 font-mono">{url}</code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            toast.success('Copied');
          } catch {
            toast.error('Could not copy — select the address instead.');
          }
        }}
      >
        <CopyIcon className="size-4" />
        <span className="sr-only">Copy {label} webhook URL</span>
      </Button>
    </div>
  );
}
