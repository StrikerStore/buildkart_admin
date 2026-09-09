'use client';

import { cn } from '@/lib/utils';

export type RankedRow = {
  key: string;
  label: string;
  sublabel?: string;
  /** The bar's magnitude. */
  value: number;
  /** What to print at the bar's tip. */
  display: string;
  href?: string;
};

/**
 * A ranked horizontal bar list.
 *
 * Built in plain HTML rather than a chart library: the marks are rectangles
 * against a shared maximum, and hand-rolling them means the label can sit
 * outside the bar end where it never gets clipped by a short bar.
 *
 * One hue for every bar. These categories — products, statuses — have no
 * natural order, so shading them by size would double-encode length as colour
 * and spend the only free channel on what the bar already shows.
 */
export function RankedBars({
  rows,
  color = '--chart-1',
  emptyLabel = 'Nothing to show yet.',
}: {
  rows: RankedRow[];
  color?: string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-xs">{emptyLabel}</p>;
  }

  // Bars are proportional to the largest, so the longest fills the track and
  // the rest are read against it.
  const peak = Math.max(...rows.map((row) => row.value), 0) || 1;

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const share = Math.max((row.value / peak) * 100, row.value > 0 ? 1.5 : 0);
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                {row.label}
                {row.sublabel && (
                  <span className="text-muted-foreground ml-1.5 text-xs">{row.sublabel}</span>
                )}
              </span>
              {/* The value rides outside the bar end, so it can never be
                  clipped by a short one. */}
              <span className="tabular shrink-0 font-medium">{row.display}</span>
            </span>

            <span
              aria-hidden
              className="bg-muted mt-1 block h-2 w-full overflow-hidden rounded-full"
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${share}%`, background: `var(${color})` }}
              />
            </span>
          </>
        );

        return (
          <li key={row.key}>
            {row.href ? (
              <a
                href={row.href}
                className={cn(
                  'hover:bg-muted/50 -mx-1.5 block rounded px-1.5 py-1 transition-colors',
                )}
              >
                {content}
              </a>
            ) : (
              <div className="-mx-1.5 px-1.5 py-1">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
