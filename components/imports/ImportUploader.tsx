'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UploadIcon, LoaderCircleIcon, AlertCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { analyseImport } from '@/app/(dashboard)/products/import/actions';

type Phase = 'idle' | 'uploading' | 'analysing';

export function ImportUploader({ configured }: { configured: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, startAnalysing] = useTransition();

  /** XHR rather than fetch: only XHR reports upload progress. */
  function put(url: string, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', 'text/csv');
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      });
      xhr.addEventListener('load', () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload failed (${xhr.status})`)),
      );
      xhr.addEventListener('error', () =>
        reject(
          new Error(
            xhr.status === 0
              ? 'Upload blocked before it reached storage. If this is a new bucket or site address, run `npm run r2:cors`.'
              : `Network error (${xhr.status})`,
          ),
        ),
      );
      xhr.send(file);
    });
  }

  async function start(file: File) {
    setError(null);
    setProgress(0);

    if (!/\.csv$/i.test(file.name)) {
      setError('Choose a .csv file exported from Shopify.');
      return;
    }

    try {
      setPhase('uploading');
      const response = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, sizeBytes: file.size }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not start the import.');
      }
      const { jobId, uploadUrl } = await response.json();

      await put(uploadUrl, file);

      // Every import is examined before it writes anything — there is no
      // opt-out, because a misread column is cheap to see now and expensive to
      // discover across 50 products afterwards.
      setPhase('analysing');
      startAnalysing(async () => {
        const result = await analyseImport(jobId);
        if (!result.ok) {
          setError(result.formErrors[0] ?? 'Could not read that file.');
          setPhase('idle');
          return;
        }
        router.push(`/products/import/${jobId}`);
        router.refresh();
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed.');
      setPhase('idle');
    }
  }

  const busy = phase !== 'idle';

  return (
    <div className="flex flex-col gap-3">
      {!configured && (
        <Alert className="border-[var(--warning-fg)]/25 bg-[var(--warning-bg)]">
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="text-[var(--warning-fg)]">
            Cloudflare R2 is not configured, so the file has nowhere to upload.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert
          variant="destructive"
          className="border-[var(--critical-fg)]/20 bg-[var(--critical-bg)]"
        >
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="text-[var(--critical-fg)]">{error}</AlertDescription>
        </Alert>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files[0];
          if (file) void start(file);
        }}
        className={cn(
          'bg-card flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center transition-colors',
          dragActive && 'border-[var(--ring)] bg-[var(--info-bg)]',
        )}
      >
        <UploadIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Drop a Shopify product CSV here</p>
          <p className="text-muted-foreground max-w-[440px]">
            Nothing is written until you review what it will do. Products are matched by Handle,
            so re-importing the same file updates rather than duplicates.
          </p>
        </div>

        <Button
          type="button"
          className="mt-1"
          disabled={busy || !configured}
          onClick={() => inputRef.current?.click()}
        >
          {busy && <LoaderCircleIcon className="size-4 animate-spin" />}
          {phase === 'uploading'
            ? `Uploading… ${progress}%`
            : phase === 'analysing'
              ? 'Reading the file…'
              : 'Choose a file'}
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void start(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
