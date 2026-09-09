'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircleIcon,
  LoaderCircleIcon,
  DownloadIcon,
  CheckIcon,
  ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { commitImport, runImageBatch, cancelImport } from '@/app/(dashboard)/products/import/actions';

export type ImportIssueRow = {
  id: string;
  rowNumber: number;
  handle: string | null;
  column: string | null;
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
};

export type ImportJobView = {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  totalProducts: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  warningCount: number;
  imagesTotal: number;
  imagesDone: number;
  imagesFailed: number;
  variantCount: number;
  lastError: string | null;
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="bg-card flex flex-col gap-0.5 rounded-lg border p-3 shadow-[var(--shadow-card)]">
      <span className={cn('tabular text-xl font-semibold', tone)}>{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

export function ImportPreview({
  job,
  issues,
}: {
  job: ImportJobView;
  issues: ImportIssueRow[];
}) {
  const router = useRouter();
  const [publishNew, setPublishNew] = useState(false);
  const [removeMissingVariants, setRemoveMissingVariants] = useState(false);
  const [isCommitting, startCommit] = useTransition();
  const [imageProgress, setImageProgress] = useState({ done: job.imagesDone, total: job.imagesTotal });
  const [running, setRunning] = useState(false);

  const isReady = job.status === 'DRY_RUN_READY';
  const isFetchingImages = job.status === 'IMPORTING_IMAGES';
  const isDone = job.status === 'COMPLETED';

  /**
   * Images are pulled in batches driven from this page rather than by a
   * background daemon. The work is resumable by construction — every image is
   * its own row with its own attempt count — so a page that keeps asking is
   * enough, and there is no long-lived loop for a redeploy to kill silently.
   */
  useEffect(() => {
    if (!isFetchingImages || running) return;

    let cancelled = false;
    const tick = async () => {
      setRunning(true);
      const result = await runImageBatch(job.id);
      setRunning(false);
      if (cancelled || !result.ok) return;

      setImageProgress((current) => ({
        done: current.done + result.data.processed,
        total: job.imagesTotal,
      }));

      if (result.data.done) {
        toast.success('Images finished');
        router.refresh();
      } else {
        setTimeout(tick, 300);
      }
    };

    void tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetchingImages, job.id]);

  function onCommit() {
    startCommit(async () => {
      const result = await commitImport(job.id, { publishNew, removeMissingVariants });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'The import failed.');
        return;
      }
      const { created, updated, imagesQueued } = result.data;
      toast.success(`${created} created, ${updated} updated`);
      if (imagesQueued > 0) toast.info(`Fetching ${imagesQueued} images…`);
      router.refresh();
    });
  }

  const errors = issues.filter((i) => i.severity === 'ERROR');
  const warnings = issues.filter((i) => i.severity === 'WARNING');

  return (
    <div className="flex flex-col gap-4">
      {job.lastError && (
        <Alert
          variant="destructive"
          className="border-[var(--critical-fg)]/20 bg-[var(--critical-bg)]"
        >
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="text-[var(--critical-fg)]">{job.lastError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Rows read" value={job.totalRows} />
        <Stat label="Products" value={job.totalProducts} />
        <Stat label={isDone ? 'Created' : 'To create'} value={job.createdCount} />
        <Stat label={isDone ? 'Updated' : 'To update'} value={job.updatedCount} />
        <Stat
          label="Skipped"
          value={job.skippedCount}
          tone={job.skippedCount > 0 ? 'text-[var(--critical-fg)]' : undefined}
        />
        <Stat label="Images" value={job.imagesTotal} />
      </div>

      {isReady && (
        <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
          <h2 className="font-semibold">Before you commit</h2>

          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="publishNew" className="font-medium">
                Publish new products immediately
              </Label>
              <p className="text-muted-foreground text-xs">
                Off by default: new products arrive as drafts so you can check them before
                customers can.
              </p>
            </div>
            <Switch id="publishNew" checked={publishNew} onCheckedChange={setPublishNew} />
          </div>

          <div className="flex items-start justify-between gap-4 border-t pt-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="removeMissing" className="font-medium">
                Deactivate variants missing from the file
              </Label>
              <p className="text-muted-foreground text-xs">
                Off by default. Variants that carry order history are deactivated, never deleted —
                but a partial file would still hide products you are still selling.
              </p>
            </div>
            <Switch
              id="removeMissing"
              checked={removeMissingVariants}
              onCheckedChange={setRemoveMissingVariants}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void cancelImport(job.id).then(() => router.push('/products/import'));
              }}
              disabled={isCommitting}
            >
              Discard
            </Button>
            <Button type="button" onClick={onCommit} disabled={isCommitting}>
              {isCommitting ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <CheckIcon className="size-4" />
              )}
              Import {job.totalProducts} product{job.totalProducts === 1 ? '' : 's'}
            </Button>
          </div>
        </section>
      )}

      {isFetchingImages && (
        <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-4" />
            <h2 className="font-semibold">Fetching images</h2>
            {running && <LoaderCircleIcon className="size-4 animate-spin" />}
          </div>
          <p className="text-muted-foreground text-xs">
            Products are already saved and usable. Images are downloading in the background —
            leaving this page pauses it, and returning resumes where it stopped.
          </p>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-[var(--nav)] transition-[width]"
              style={{
                width: `${imageProgress.total > 0 ? Math.round((imageProgress.done / imageProgress.total) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="text-muted-foreground tabular text-xs">
            {imageProgress.done} of {imageProgress.total}
            {job.imagesFailed > 0 && ` · ${job.imagesFailed} failed`}
          </p>
        </section>
      )}

      {isDone && (
        <Alert className="border-[var(--success-fg)]/25 bg-[var(--success-bg)]">
          <CheckIcon className="size-4" />
          <AlertDescription className="text-[var(--success-fg)]">
            Import finished — {job.createdCount} created, {job.updatedCount} updated,{' '}
            {job.imagesDone} images stored
            {job.imagesFailed > 0 && `, ${job.imagesFailed} images could not be fetched`}.{' '}
            <Link href="/products" className="underline">
              View products
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {issues.length > 0 && (
        <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {errors.length > 0 && (
                <span className="text-[var(--critical-fg)]">{errors.length} error
                  {errors.length === 1 ? '' : 's'}</span>
              )}
              {errors.length > 0 && warnings.length > 0 && ' · '}
              {warnings.length > 0 && (
                <span className="text-[var(--warning-fg)]">
                  {warnings.length} warning{warnings.length === 1 ? '' : 's'}
                </span>
              )}
            </h2>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/imports/${job.id}/errors`}>
                <DownloadIcon className="size-4" />
                Download report
              </a>
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            Products with an error are skipped; everything else still imports. Row numbers match
            the spreadsheet, so the report opens straight onto the line to fix.
          </p>

          <ul className="max-h-[360px] overflow-y-auto rounded-md border">
            {issues.slice(0, 200).map((issue) => (
              <li key={issue.id} className="flex items-start gap-3 border-b px-3 py-2 last:border-b-0">
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    issue.severity === 'ERROR'
                      ? 'bg-[var(--critical-bg)] text-[var(--critical-fg)]'
                      : 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
                  )}
                >
                  Row {issue.rowNumber}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{issue.message}</span>
                  <span className="text-muted-foreground block text-xs">
                    {[issue.handle, issue.column].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {issues.length > 200 && (
            <p className="text-muted-foreground text-xs">
              Showing the first 200. The downloaded report has all {issues.length}.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
