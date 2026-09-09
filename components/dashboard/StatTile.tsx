import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { formatPercentChange } from '@StrikerStore/contract';
import { cn } from '@/lib/utils';

/**
 * A headline number.
 *
 * The right form when the data is one current value — a one-bar bar chart would
 * say the same thing with more ink and less clarity.
 */
export function StatTile({
  label,
  value,
  change,
  comparison,
  /** False where a rise is bad, so the arrow's colour tracks meaning not direction. */
  upIsGood = true,
  footnote,
}: {
  label: string;
  value: string;
  change?: number | null;
  comparison?: string;
  upIsGood?: boolean;
  footnote?: string;
}) {
  const hasChange = change !== undefined && change !== null && Math.round(change * 10) !== 0;
  const isUp = (change ?? 0) > 0;
  const isGood = isUp === upIsGood;

  return (
    <div className="bg-card flex flex-col gap-1 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <span className="text-muted-foreground text-xs">{label}</span>

      {/* Proportional figures: tabular digits make a standalone number look
          loose at this size. Tabular is for columns that align. */}
      <span className="text-2xl leading-tight font-semibold">{value}</span>

      <span className="flex items-center gap-1.5 text-xs">
        {hasChange ? (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                isGood ? 'text-[var(--success-fg)]' : 'text-[var(--critical-fg)]',
              )}
            >
              {/* An icon beside the figure, so direction never rests on colour. */}
              {isUp ? (
                <ArrowUpRightIcon className="size-3.5" />
              ) : (
                <ArrowDownRightIcon className="size-3.5" />
              )}
              {formatPercentChange(change ?? null)}
            </span>
            {comparison && <span className="text-muted-foreground">{comparison}</span>}
          </>
        ) : (
          <span className="text-muted-foreground">{footnote ?? comparison ?? ' '}</span>
        )}
      </span>
    </div>
  );
}
