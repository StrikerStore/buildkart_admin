'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import type { AuditLogEntryDto } from '@buildkart/contract';
import {
  describeAction,
  describeEntity,
  formatStoreDateTime,
  formatStoreDateTimeShort,
  linkForEntity,
} from '@buildkart/contract';
import { DiffViewer } from './DiffViewer';
import { cn } from '@/lib/utils';

/**
 * The log, one row per entry, expanding to show what changed.
 *
 * Collapsed by default because the answer to "what happened here" is usually
 * the action and the time; the diff is the follow-up question, and putting it
 * inline would make fifty rows unscannable.
 */
export function AuditTable({ entries }: { entries: AuditLogEntryDto[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
      <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium md:flex">
        <span className="w-5 shrink-0" />
        <span className="min-w-0 flex-1">What happened</span>
        <span className="w-[150px] shrink-0">Who</span>
        <span className="w-[150px] shrink-0 text-right">When</span>
      </div>

      <ul>
        {entries.map((entry) => {
          const isOpen = open.has(entry.id);
          const href = linkForEntity(entry.entityType, entry.entityId);

          return (
            <li key={entry.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(entry.id)}
                aria-expanded={isOpen}
                className={cn(
                  'hover:bg-muted/40 flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors md:flex-row md:items-center md:gap-3',
                  isOpen && 'bg-muted/30',
                )}
              >
                <span className="text-muted-foreground hidden w-5 shrink-0 md:block">
                  {isOpen ? (
                    <ChevronDownIcon className="size-4" />
                  ) : (
                    <ChevronRightIcon className="size-4" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{describeAction(entry.action)}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {describeEntity(entry.entityType)} · {entry.entityId}
                  </span>
                </span>

                <span className="text-muted-foreground shrink-0 truncate text-xs md:w-[150px]">
                  {entry.adminName ?? 'System'}
                </span>

                <span
                  className="text-muted-foreground shrink-0 text-xs md:w-[150px] md:text-right"
                  title={formatStoreDateTime(entry.createdAt)}
                >
                  {formatStoreDateTimeShort(entry.createdAt)}
                </span>
              </button>

              {isOpen && (
                <div className="bg-muted/20 flex flex-col gap-3 border-t px-3 py-3 md:pl-11">
                  <DiffViewer diff={entry.diff} />

                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span>{formatStoreDateTime(entry.createdAt)}</span>
                    {entry.adminEmail && <span>{entry.adminEmail}</span>}
                    {entry.ip && <span>from {entry.ip}</span>}
                    <span className="font-mono">{entry.action}</span>
                    {href && (
                      <Link href={href} className="text-[var(--nav)] font-medium hover:underline">
                        Open the {describeEntity(entry.entityType).toLowerCase()}
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
