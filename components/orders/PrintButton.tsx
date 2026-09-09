'use client';

import { PrinterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The only interactive thing on the slip, so it is the only client component. */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <PrinterIcon className="size-4" />
      Print
    </Button>
  );
}
