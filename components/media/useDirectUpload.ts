'use client';

import { useCallback, useState } from 'react';

export type UploadItem = {
  /** Local identity while in flight; becomes the Media id once presigned. */
  localId: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'confirming' | 'done' | 'error';
  mediaId?: string;
  error?: string;
};

/** Reads intrinsic dimensions so the grid can reserve the right aspect box. */
async function readDimensions(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    // Cosmetic only — an unreadable image still uploads fine.
    return {};
  }
}

/**
 * Uploads through XMLHttpRequest rather than fetch.
 *
 * fetch has no upload-progress event. For a contractor on a slow connection
 * pushing ten product photos, a progress bar is the difference between "it's
 * working" and "it's broken" — so the older API earns its place here.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    // Must match the Content-Type that was signed, or the signature is invalid.
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener('load', () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`)),
    );
    xhr.addEventListener('error', () =>
      // A cross-origin request blocked by CORS surfaces here as a plain error
      // with status 0 — the browser withholds the real response. Naming the
      // likely cause turns an opaque "network error" into something fixable,
      // because server-side tests cannot reproduce it at all.
      reject(
        new Error(
          xhr.status === 0
            ? 'Upload blocked before it reached storage. If this is a new bucket or a new site address, run `npm run r2:cors` to allow this origin.'
            : `Network error during upload (${xhr.status})`,
        ),
      ),
    );
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.send(file);
  });
}

export function useDirectUpload({
  prefix = 'products',
  onUploaded,
}: {
  prefix?: 'products' | 'categories' | 'banners' | 'reviews';
  /**
   * The files come back beside their ids so a caller can preview an upload
   * from the local bytes — a video especially, which has no resized thumbnail
   * to fetch — without a round trip to find out what it just sent.
   */
  onUploaded?: (mediaIds: string[], uploads: Array<{ mediaId: string; file: File }>) => void;
} = {}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const patch = useCallback((localId: string, changes: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.localId === localId ? { ...item, ...changes } : item)),
    );
  }, []);

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const queued: UploadItem[] = files.map((file) => ({
        localId: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: 'queued',
      }));

      setItems((current) => [...current, ...queued]);
      setIsUploading(true);

      const succeeded: string[] = [];
      const uploaded: Array<{ mediaId: string; file: File }> = [];

      // Sequential on purpose: parallel uploads on a weak connection make every
      // bar crawl at once, which reads as a hang. One at a time finishes sooner
      // in practice and always shows visible movement.
      for (const item of queued) {
        try {
          patch(item.localId, { status: 'uploading' });

          const presignResponse = await fetch('/api/media/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: item.file.name,
              contentType: item.file.type,
              sizeBytes: item.file.size,
              prefix,
            }),
          });

          if (!presignResponse.ok) {
            const body = await presignResponse.json().catch(() => ({}));
            throw new Error(body.error ?? 'Could not start the upload.');
          }

          const { mediaId, uploadUrl } = await presignResponse.json();

          await putWithProgress(uploadUrl, item.file, (percent) =>
            patch(item.localId, { progress: percent }),
          );

          patch(item.localId, { status: 'confirming', progress: 100 });

          const dimensions = await readDimensions(item.file);
          const completeResponse = await fetch('/api/media/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mediaId, ...dimensions }),
          });

          if (!completeResponse.ok) {
            const body = await completeResponse.json().catch(() => ({}));
            throw new Error(body.error ?? 'Upload could not be confirmed.');
          }

          patch(item.localId, { status: 'done', mediaId });
          succeeded.push(mediaId);
          uploaded.push({ mediaId, file: item.file });
        } catch (error) {
          patch(item.localId, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed.',
          });
        }
      }

      setIsUploading(false);
      if (succeeded.length > 0) onUploaded?.(succeeded, uploaded);
    },
    [patch, prefix, onUploaded],
  );

  const clearFinished = useCallback(() => {
    setItems((current) => current.filter((item) => item.status !== 'done'));
  }, []);

  /** Drops finished and failed rows alike, for a form opened afresh. In-flight rows stay. */
  const clearSettled = useCallback(() => {
    setItems((current) =>
      current.filter((item) => item.status !== 'done' && item.status !== 'error'),
    );
  }, []);

  return { items, isUploading, upload, clearFinished, clearSettled };
}
