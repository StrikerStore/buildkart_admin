'use client';

import { Fragment, useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { formatINR, type AdNodeDto } from '@StrikerStore/contract';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { percent, times } from '@/lib/analytics-query';

const inr = (value: string | null) => (value === null ? '—' : formatINR(value));
const LEVELS = ['Campaign', 'Ad set', 'Ad'] as const;

/**
 * Campaign → ad set → ad, one table, expanded in place.
 *
 * In place rather than on separate pages so the row being opened stays beside
 * its siblings: the question is almost always "which of these ad sets is
 * carrying this campaign", and that is a comparison, not a navigation.
 *
 * ROAS is the shop's own — orders matched by the utm_campaign / utm_term /
 * utm_content ids on the click — with Meta's own figure in a muted column
 * beside it. An order whose ad set or ad tag is missing still counts for its
 * campaign, so a campaign's orders can exceed the sum of its ad sets'.
 */
export function AdTree({ campaigns }: { campaigns: AdNodeDto[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const rows = (nodes: AdNodeDto[], depth: number, parentKey: string): React.ReactNode =>
    nodes.map((node) => {
      const key = `${parentKey}/${node.id}`;
      const expandable = node.children.length > 0;
      const isOpen = open.has(key);
      return (
        <Fragment key={key}>
          <TableRow className={cn(depth > 0 && 'bg-muted/30')}>
            <TableCell className="max-w-72">
              <div className="flex items-start gap-1" style={{ paddingLeft: depth * 16 }}>
                {expandable ? (
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
                    className="hover:bg-muted -my-0.5 rounded p-0.5"
                  >
                    <ChevronRightIcon
                      className={cn('size-4 transition-transform', isOpen && 'rotate-90')}
                    />
                  </button>
                ) : (
                  <span className="inline-block size-5 shrink-0" aria-hidden />
                )}
                <div className="min-w-0">
                  <span className="block truncate" title={node.name}>
                    {node.name}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {LEVELS[depth]} · {node.id}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatINR(node.spend)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {node.impressions.toLocaleString('en-IN')}
            </TableCell>
            <TableCell className="text-right tabular-nums">{percent(node.ctr, 2)}</TableCell>
            <TableCell className="text-right tabular-nums">{inr(node.cpm)}</TableCell>
            <TableCell className="text-right tabular-nums">{node.orders}</TableCell>
            <TableCell className="text-right tabular-nums">{formatINR(node.revenue)}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {times(node.roas)}
            </TableCell>
            <TableCell className="text-muted-foreground text-right tabular-nums">
              {times(node.metaRoas)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{inr(node.cpa)}</TableCell>
          </TableRow>
          {isOpen && rows(node.children, depth + 1, key)}
        </Fragment>
      );
    });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campaign / ad set / ad</TableHead>
          <TableHead className="text-right">Spend</TableHead>
          <TableHead className="text-right">Impr.</TableHead>
          <TableHead className="text-right">CTR</TableHead>
          <TableHead className="text-right">CPM</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">ROAS</TableHead>
          <TableHead className="text-right">Meta ROAS</TableHead>
          <TableHead className="text-right">CPA</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{rows(campaigns, 0, '')}</TableBody>
    </Table>
  );
}
