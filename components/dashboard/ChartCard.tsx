'use client';

import { useId, useState } from 'react';
import { BarChart3Icon, TableIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The frame every chart sits in.
 *
 * Carries the table-view toggle, which is not decoration: a tooltip must never
 * be the only way to read a value, so every chart ships with a WCAG-clean
 * equivalent behind one button.
 */
export function ChartCard({
  title,
  subtitle,
  headline,
  table,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  /** The period figure, shown beside the title so the chart is not the only source. */
  headline?: string;
  table: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const regionId = useId();

  return (
    <section
      className={cn(
        'bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* Proportional figures, not tabular: equal-width digits make a
              standalone number look loose at this size. */}
          {headline && <span className="text-lg leading-none font-semibold">{headline}</span>}
          <button
            type="button"
            onClick={() => setShowTable((current) => !current)}
            aria-expanded={showTable}
            aria-controls={regionId}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1.5 transition-colors"
            title={showTable ? 'Show the chart' : 'Show the numbers'}
          >
            {showTable ? (
              <BarChart3Icon className="size-4" />
            ) : (
              <TableIcon className="size-4" />
            )}
            <span className="sr-only">{showTable ? 'Show the chart' : 'Show the numbers'}</span>
          </button>
        </div>
      </div>

      <div id={regionId}>{showTable ? table : children}</div>
    </section>
  );
}

/** The table twin. Tabular figures here, where numbers align in columns. */
export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="max-h-[260px] overflow-y-auto">
      <table className="w-full text-left">
        <thead className="bg-card sticky top-0">
          <tr className="text-muted-foreground border-b text-xs">
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={cn('py-1.5 font-medium', index > 0 && 'text-right')}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn('py-1.5', cellIndex > 0 && 'tabular text-right')}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
