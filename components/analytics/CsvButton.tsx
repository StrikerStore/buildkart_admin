'use client';

import { DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Cell = string | number | null | undefined;

/** RFC 4180 quoting, plus a leading quote on anything a spreadsheet would run as a formula. */
function cell(value: Cell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text) && typeof value === 'string') text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Downloads exactly the table on screen as CSV.
 *
 * Built in the browser from the rows the page already rendered, so the file
 * cannot disagree with what the owner was looking at, and there is no second
 * export path on the API to keep in step.
 */
export function CsvButton({
  filename,
  columns,
  rows,
}: {
  filename: string;
  columns: string[];
  rows: Cell[][];
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => {
        // A BOM so Excel opens ₹ and Devanagari as UTF-8 rather than mojibake.
        const text = '﻿' + [columns, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      }}
    >
      <DownloadIcon className="size-4" />
      CSV
    </Button>
  );
}
