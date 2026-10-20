import Link from 'next/link';
import {
  NOTIFICATION_EVENT_LABELS,
  formatStoreDateTime,
  formatStoreDateTimeShort,
  type NotificationMessageDto,
} from '@StrikerStore/contract';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<NotificationMessageDto['status'], string> = {
  QUEUED: 'bg-muted text-muted-foreground',
  SENT: 'bg-[var(--success-bg)] text-[var(--success-fg)]',
  FAILED: 'bg-[var(--critical-bg)] text-[var(--critical-fg)]',
  SKIPPED: 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
};

const STATUS_WORDS: Record<NotificationMessageDto['status'], string> = {
  QUEUED: 'Queued',
  SENT: 'Sent',
  FAILED: 'Failed',
  SKIPPED: 'Not sent',
};

const SKIP_WORDS: Record<string, string> = {
  opted_out: 'Customer turned off WhatsApp updates',
  no_marketing_consent: 'Customer has not said yes to offers on WhatsApp',
  invalid_number: 'Not a valid mobile number',
};

/**
 * What went out on WhatsApp, newest first.
 *
 * The status is the point of the screen — "did they get it" is the question
 * someone opens it to answer — so it leads each row, and a failure or skip
 * says why in words rather than a code.
 */
export function MessageLog({
  messages,
  showOrderLink = true,
}: {
  messages: NotificationMessageDto[];
  showOrderLink?: boolean;
}) {
  if (messages.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border px-3 py-6 text-center text-sm">
        No WhatsApp messages yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
        {messages.map((message) => {
          const why =
            message.status === 'SKIPPED'
              ? (SKIP_WORDS[message.skipReason ?? ''] ?? message.skipReason)
              : message.status === 'FAILED' || (message.status === 'QUEUED' && message.lastError)
                ? message.lastError
                : null;

          return (
            <li
              key={message.id}
              className="flex flex-col gap-1 border-b px-3 py-2.5 last:border-b-0 md:flex-row md:items-center md:gap-3"
            >
              <span
                className={cn(
                  'w-fit shrink-0 rounded px-1.5 py-0.5 text-xs md:w-[84px] md:text-center',
                  STATUS_STYLES[message.status],
                )}
              >
                {STATUS_WORDS[message.status]}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {NOTIFICATION_EVENT_LABELS[message.event] ?? message.event}
                  <span className="text-muted-foreground font-normal"> · +{message.phone}</span>
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {message.templateName}
                  {showOrderLink && message.orderId && (
                    <>
                      {' · '}
                      <Link href={`/orders/${message.orderId}`} className="underline">
                        order
                      </Link>
                    </>
                  )}
                  {why && <span className="text-[var(--critical-fg)]"> · {why}</span>}
                </span>
              </span>

              <span
                className="text-muted-foreground shrink-0 text-xs md:w-[150px] md:text-right"
                title={formatStoreDateTime(message.createdAt)}
              >
                {formatStoreDateTimeShort(message.createdAt)}
              </span>
            </li>
          );
        })}
      </ul>
      {/* The Campaign API answers "accepted" and nothing more. */}
      <p className="text-muted-foreground text-xs">
        Sent means AiSensy accepted it. Delivered and read are in AiSensy → Campaigns.
      </p>
    </div>
  );
}
