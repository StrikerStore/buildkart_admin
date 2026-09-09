'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  UploadIcon,
  LoaderCircleIcon,
  Trash2Icon,
  AlertCircleIcon,
  ImageIcon,
  CheckIcon,
  LinkIcon,
  SearchIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildMediaUrl, ADMIN_THUMB_2X, ADMIN_PREVIEW, type MediaSortKey } from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useDirectUpload } from './useDirectUpload';
import { updateMediaAltText, deleteMedia, deleteManyMedia } from '@/app/(dashboard)/media/actions';
import type { MediaDto } from '@buildkart/contract';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "20 Aug at 4:25 am" — the compact form Shopify uses in this table. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = date
    .toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
  return `${day} at ${time}`;
}

/** The file extension, shown under the name as a type label. */
function fileType(filename: string, mimeType: string): string {
  const ext = filename.split('.').pop();
  if (ext && ext.length <= 5) return ext.toUpperCase();
  return mimeType.split('/')[1]?.toUpperCase() ?? 'FILE';
}

/**
 * Column widths are declared once and used by both the header and the rows, so
 * the two cannot drift out of alignment.
 *
 * Note `lg:flex` rather than `lg:block` on the responsive columns: `block` is
 * also a display utility and wins over the base `flex` at that breakpoint,
 * which silently kills `items-center` and drops the sort arrow onto its own
 * line under the label.
 */
const COL = {
  name: 'flex-1 min-w-0',
  alt: 'hidden md:flex w-[260px] shrink-0',
  date: 'hidden lg:flex w-[150px] shrink-0',
  size: 'hidden sm:flex w-[80px] shrink-0 justify-end',
} as const;

const SORTABLE: Array<{ key: MediaSortKey; label: string; className: string }> = [
  { key: 'name', label: 'File name', className: `flex ${COL.name}` },
  { key: 'date', label: 'Date added', className: COL.date },
  { key: 'size', label: 'Size', className: COL.size },
];

function SortHeader({
  column,
  query,
  onSort,
}: {
  column: { key: MediaSortKey; label: string; className: string };
  query: { sort: MediaSortKey; order: 'asc' | 'desc' };
  onSort: (key: MediaSortKey) => void;
}) {
  const active = query.sort === column.key;
  const Arrow = query.order === 'asc' ? ArrowUpIcon : ArrowDownIcon;

  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      aria-sort={active ? (query.order === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'hover:text-foreground items-center gap-1 transition-colors',
        column.className,
        active && 'text-foreground',
      )}
    >
      <span className="truncate">{column.label}</span>
      {/* Reserved whether or not this column is sorted, so the labels do not
          shift sideways as you click between columns. */}
      <Arrow className={cn('size-3 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
    </button>
  );
}

export function MediaLibrary({
  media,
  publicBaseUrl,
  transformsEnabled,
  configured,
  query,
  totalPages,
}: {
  media: MediaDto[];
  publicBaseUrl: string | null;
  transformsEnabled: boolean;
  configured: boolean;
  query: { q?: string; sort: MediaSortKey; order: 'asc' | 'desc'; page: number };
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [selected, setSelected] = useState<MediaDto | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(query.q ?? '');
  const [, startNavigating] = useTransition();
  const [isBulkDeleting, startBulkDelete] = useTransition();

  const { items, isUploading, upload, clearFinished } = useDirectUpload({
    prefix: 'products',
    onUploaded: (ids) => {
      toast.success(`${ids.length} file${ids.length === 1 ? '' : 's'} uploaded`);
      clearFinished();
      router.refresh();
    },
  });

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    startNavigating(() => router.replace(next.toString() ? `${pathname}?${next}` : pathname));
  }

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    if (search === (params.get('q') ?? '')) return;
    const timer = setTimeout(() => navigate({ q: search, page: null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // A selection that refers to rows no longer on screen would delete
  // invisible files, so it is cleared whenever the result set changes.
  useEffect(() => setChecked(new Set()), [media]);

  function toggleSort(key: MediaSortKey) {
    // Same column flips direction; a new column starts at the sensible default —
    // A–Z for names, newest and largest first for dates and sizes.
    const order = query.sort === key ? (query.order === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc';
    navigate({ sort: key, order, page: null });
  }

  function thumb(item: MediaDto, width: number): string | null {
    if (!publicBaseUrl) return null;
    return buildMediaUrl(publicBaseUrl, transformsEnabled, item, { w: width });
  }

  function publicUrl(item: MediaDto): string | null {
    if (!publicBaseUrl) return null;
    return buildMediaUrl(publicBaseUrl, false, item);
  }

  async function copyLink(item: MediaDto) {
    const url = publicUrl(item);
    if (!url) {
      toast.error('No public URL is configured for the bucket.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      // Clipboard access needs a secure context; http://localhost counts, but a
      // plain-http LAN address does not.
      toast.error('Could not copy. Your browser blocked clipboard access.');
    }
  }

  function onBulkDelete() {
    const ids = [...checked];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} file${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;

    startBulkDelete(async () => {
      const result = await deleteManyMedia(ids);
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not delete those files.');
        return;
      }
      const { deleted, blocked } = result.data;
      if (deleted > 0) toast.success(`${deleted} file${deleted === 1 ? '' : 's'} deleted`);
      // Files still attached to something are reported rather than skipped
      // silently — otherwise the count just looks wrong.
      if (blocked.length > 0) {
        toast.warning(
          `${blocked.length} still in use and kept: ${blocked.slice(0, 3).join(', ')}${blocked.length > 3 ? '…' : ''}`,
        );
      }
      setChecked(new Set());
      router.refresh();
    });
  }

  const inFlight = items.filter((i) => i.status !== 'done');
  const allChecked = media.length > 0 && checked.size === media.length;

  return (
    <div className="flex flex-col gap-4">
      {!configured && (
        <Alert className="border-[var(--warning-fg)]/25 bg-[var(--warning-bg)]">
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="text-[var(--warning-fg)]">
            Cloudflare R2 is not configured yet, so uploads will fail. Add an R2 API token
            (R2 → Manage API tokens → Object Read &amp; Write) to <code>.env</code>.
          </AlertDescription>
        </Alert>
      )}

      {/* Compact dropzone: the table is the point of this screen, so uploading
          takes a strip rather than half the viewport. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          void upload(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          'bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors',
          dragActive && 'border-[var(--ring)] bg-[var(--info-bg)]',
        )}
      >
        <span className="text-muted-foreground flex items-center gap-2">
          <UploadIcon className="size-4" strokeWidth={1.75} />
          Drag images here — JPG, PNG, WebP or AVIF, up to 10 MB each
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading && <LoaderCircleIcon className="size-4 animate-spin" />}
          {isUploading ? 'Uploading…' : 'Upload files'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </div>

      {inFlight.length > 0 && (
        <ul className="bg-card flex flex-col gap-2 rounded-lg border p-3 shadow-[var(--shadow-card)]">
          {inFlight.map((item) => (
            <li key={item.localId} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-xs">{item.file.name}</span>
              {item.status === 'error' ? (
                <span className="text-[var(--critical-fg)] shrink-0 text-xs">{item.error}</span>
              ) : (
                <>
                  <span className="bg-muted h-1.5 w-32 shrink-0 overflow-hidden rounded-full">
                    <span
                      className="block h-full rounded-full bg-[var(--nav)] transition-[width]"
                      style={{ width: `${item.progress}%` }}
                    />
                  </span>
                  <span className="text-muted-foreground tabular w-16 shrink-0 text-right text-xs">
                    {item.status === 'confirming' ? 'Verifying' : `${item.progress}%`}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
        {/* Toolbar: search, or bulk actions once rows are selected. */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          {checked.size > 0 ? (
            <>
              <span className="font-medium">
                {checked.size} selected
              </span>
              <div className="flex-1" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBulkDelete}
                disabled={isBulkDeleting}
                className="text-[var(--critical-fg)] hover:text-[var(--critical-fg)]"
              >
                {isBulkDeleting ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <Trash2Icon className="size-4" />
                )}
                Delete
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setChecked(new Set())}>
                <XIcon className="size-4" />
              </Button>
            </>
          ) : (
            <div className="relative w-full max-w-sm">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by file name or alt text"
                className="h-8 pl-8"
              />
            </div>
          )}
        </div>

        {/* Column headers. Sorting is server-side via the URL, so it holds
            across pages and survives a refresh. */}
        <div className="text-muted-foreground bg-muted/40 flex items-center gap-3 border-b px-3 py-2 text-xs font-medium">
          <span className="flex w-4 shrink-0 items-center">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(value) =>
                setChecked(value ? new Set(media.map((m) => m.id)) : new Set())
              }
              aria-label="Select all files"
            />
          </span>
          <span className="w-10 shrink-0" />

          {/* File name, then Alt text, then Date added and Size — the order of
              the Shopify Files table this mirrors. */}
          <SortHeader column={SORTABLE[0]!} query={query} onSort={toggleSort} />
          <span className={COL.alt}>Alt text</span>
          <SortHeader column={SORTABLE[1]!} query={query} onSort={toggleSort} />
          <SortHeader column={SORTABLE[2]!} query={query} onSort={toggleSort} />

          <span className="w-8 shrink-0" />
        </div>

        {media.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <ImageIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
            <p className="font-medium">{query.q ? 'No files match that search' : 'No images yet'}</p>
            <p className="text-muted-foreground max-w-[380px]">
              {query.q
                ? 'Try a different file name or alt text.'
                : 'Images uploaded here can be attached to any number of products, categories and banners.'}
            </p>
          </div>
        ) : (
          <ul>
            {media.map((item) => {
              const src = thumb(item, ADMIN_THUMB_2X);
              const isChecked = checked.has(item.id);

              return (
                <li
                  key={item.id}
                  className={cn(
                    'hover:bg-muted/40 flex items-center gap-3 border-b px-3 py-2 transition-colors last:border-b-0',
                    isChecked && 'bg-[var(--info-bg)]',
                  )}
                >
                  <span className="flex w-4 shrink-0 items-center">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(value) =>
                        setChecked((current) => {
                          const next = new Set(current);
                          if (value) next.add(item.id);
                          else next.delete(item.id);
                          return next;
                        })
                      }
                      aria-label={`Select ${item.filename}`}
                    />
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="bg-muted flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border"
                    aria-label={`Open ${item.filename}`}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={item.altTextEn ?? ''}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="text-muted-foreground size-4" strokeWidth={1.5} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className={cn('text-left', COL.name)}
                  >
                    <span className="block truncate font-medium">{item.filename}</span>
                    <span className="text-muted-foreground block text-xs">
                      {fileType(item.filename, item.mimeType)}
                      {item.usageCount > 0 && ` · used ${item.usageCount}×`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className={cn('min-w-0 text-left text-xs', COL.alt)}
                  >
                    {item.altTextEn ? (
                      <span className="truncate text-[var(--info-fg)]">{item.altTextEn}</span>
                    ) : (
                      <span className="text-muted-foreground truncate italic">Add alt text</span>
                    )}
                  </button>

                  <span className={cn('text-muted-foreground text-xs', COL.date)}>
                    {formatDate(item.createdAt)}
                  </span>

                  <span className={cn('text-muted-foreground tabular text-xs', COL.size)}>
                    {formatBytes(item.sizeBytes)}
                  </span>

                  <button
                    type="button"
                    onClick={() => void copyLink(item)}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-8 shrink-0 items-center justify-center rounded transition-colors"
                    aria-label={`Copy link to ${item.filename}`}
                    title="Copy link"
                  >
                    <LinkIcon className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            Page {query.page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={query.page <= 1}
              onClick={() => navigate({ page: String(query.page - 1) })}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={query.page >= totalPages}
              onClick={() => navigate({ page: String(query.page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <MediaDetailDialog
        media={selected}
        previewSrc={selected ? thumb(selected, ADMIN_PREVIEW) : null}
        publicUrl={selected ? publicUrl(selected) : null}
        onClose={() => setSelected(null)}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

function MediaDetailDialog({
  media,
  previewSrc,
  publicUrl,
  onClose,
  onChanged,
}: {
  media: MediaDto | null;
  previewSrc: string | null;
  publicUrl: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [altEn, setAltEn] = useState('');
  const [altHi, setAltHi] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (media && loadedFor !== media.id) {
    setLoadedFor(media.id);
    setAltEn(media.altTextEn ?? '');
    setAltHi(media.altTextHi ?? '');
    setError(null);
  }

  if (!media) return null;

  function onSave() {
    if (!media) return;
    setError(null);
    startSaving(async () => {
      const result = await updateMediaAltText(media.id, { altTextEn: altEn, altTextHi: altHi });
      if (!result.ok) {
        setError(result.formErrors[0] ?? 'Could not save.');
        return;
      }
      toast.success('Alt text saved');
      onChanged();
      onClose();
    });
  }

  function onDelete() {
    if (!media) return;
    setError(null);
    startDeleting(async () => {
      const result = await deleteMedia(media.id);
      if (!result.ok) {
        setError(result.formErrors[0] ?? 'Could not delete this file.');
        return;
      }
      toast.success('File deleted');
      onChanged();
      onClose();
    });
  }

  const busy = isSaving || isDeleting;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="truncate">{media.filename}</DialogTitle>
          <DialogDescription>
            {media.width && media.height ? `${media.width} × ${media.height} · ` : ''}
            {formatBytes(media.sizeBytes)} · {media.mimeType}
            {media.usageCount > 0 &&
              ` · used in ${media.usageCount} place${media.usageCount === 1 ? '' : 's'}`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert
            variant="destructive"
            className="border-[var(--critical-fg)]/20 bg-[var(--critical-bg)]"
          >
            <AlertCircleIcon className="size-4" />
            <AlertDescription className="text-[var(--critical-fg)]">{error}</AlertDescription>
          </Alert>
        )}

        <div className="bg-muted flex max-h-[280px] items-center justify-center overflow-hidden rounded-md border">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={media.altTextEn ?? ''}
              className="max-h-[280px] object-contain"
            />
          ) : (
            <ImageIcon className="text-muted-foreground m-10 size-8" strokeWidth={1.5} />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="altEn">Alt text (English)</Label>
            <Input
              id="altEn"
              value={altEn}
              onChange={(e) => setAltEn(e.target.value)}
              placeholder="UltraTech cement bag, 50 kg"
              maxLength={512}
            />
            <p className="text-muted-foreground text-xs">
              Describes the image for screen readers and search engines.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="altHi">Alt text (Hindi)</Label>
            <Input
              id="altHi"
              value={altHi}
              onChange={(e) => setAltHi(e.target.value)}
              lang="hi"
              maxLength={512}
            />
          </div>

          {publicUrl && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="publicUrl">Public link</Label>
              <div className="flex gap-2">
                <Input id="publicUrl" value={publicUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(publicUrl);
                      toast.success('Link copied');
                    } catch {
                      toast.error('Could not copy.');
                    }
                  }}
                >
                  <LinkIcon className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            disabled={busy}
            className="text-[var(--critical-fg)] hover:text-[var(--critical-fg)]"
          >
            {isDeleting ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <Trash2Icon className="size-4" />
            )}
            Delete
          </Button>
          <Button type="button" onClick={onSave} disabled={busy}>
            {isSaving ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
