'use client';

import { useState } from 'react';
import { CheckIcon, PlusIcon } from 'lucide-react';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_HINTS,
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_GROUPS,
  NOTIFICATION_GROUP_LABELS,
  eventGroup,
  type NotificationChannel,
  type NotificationEvent,
  type NotificationTemplateDto,
} from '@StrikerStore/contract';
import { TemplateEditor, type EditorTarget } from './TemplateEditor';
import { cn } from '@/lib/utils';

/**
 * Every event against every channel.
 *
 * A grid rather than a list because the useful question is not "what have I
 * written" but "what happens to a customer, and where is the gap" — an empty
 * cell is the answer to the second, and a list of what exists cannot show it.
 *
 * English only on the grid. The Hindi row is reachable from the editor; putting
 * both here would double a screen whose whole job is to be scannable.
 */
export function EventMatrix({
  templates,
  enabledChannels,
}: {
  templates: NotificationTemplateDto[];
  /** Channels with a provider actually switched on. */
  enabledChannels: NotificationChannel[];
}) {
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [locale, setLocale] = useState<'en' | 'hi'>('en');

  const find = (event: NotificationEvent, channel: NotificationChannel) =>
    templates.find(
      (t) => t.event === event && t.channel === channel && t.locale === locale,
    ) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 self-start rounded-md border p-0.5">
        {(['en', 'hi'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              locale === option ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
          >
            {option === 'en' ? 'English' : 'हिन्दी'}
          </button>
        ))}
      </div>

      {NOTIFICATION_GROUPS.map((group) => {
        const events = NOTIFICATION_EVENTS.filter((event) => eventGroup(event) === group);

        return (
          <section key={group} className="flex flex-col gap-2">
            <h2 className="font-semibold">{NOTIFICATION_GROUP_LABELS[group]}</h2>

            <div className="bg-card overflow-x-auto rounded-lg border shadow-[var(--shadow-card)]">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="px-3 py-2 font-medium">When</th>
                    {NOTIFICATION_CHANNELS.map((channel) => (
                      <th key={channel} className="w-[130px] px-3 py-2 font-medium">
                        {NOTIFICATION_CHANNEL_LABELS[channel]}
                        {!enabledChannels.includes(channel) && (
                          <span className="text-muted-foreground block font-normal">
                            no provider
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event} className="border-b last:border-b-0">
                      <td className="px-3 py-2.5">
                        <span className="block font-medium">
                          {NOTIFICATION_EVENT_LABELS[event]}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {NOTIFICATION_EVENT_HINTS[event]}
                        </span>
                      </td>

                      {NOTIFICATION_CHANNELS.map((channel) => {
                        const existing = find(event, channel);
                        return (
                          <td key={channel} className="px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => setTarget({ event, channel, locale, existing })}
                              className={cn(
                                'flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
                                existing?.isActive
                                  ? 'border-[var(--success-fg)]/40 bg-[var(--success-bg)] text-[var(--success-fg)]'
                                  : existing
                                    ? 'hover:bg-muted/40'
                                    : 'text-muted-foreground border-dashed hover:bg-muted/40',
                              )}
                            >
                              {existing?.isActive ? (
                                <>
                                  <CheckIcon className="size-3.5 shrink-0" />
                                  On
                                </>
                              ) : existing ? (
                                'Draft'
                              ) : (
                                <>
                                  <PlusIcon className="size-3.5 shrink-0" />
                                  Write
                                </>
                              )}

                              {existing && channel === 'SMS' && existing.smsSegments > 1 && (
                                <span className="ml-auto shrink-0 font-normal opacity-70">
                                  {existing.smsSegments}×
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <TemplateEditor target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
