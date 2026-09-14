'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ImageIcon,
  LoaderCircleIcon,
  MessageSquareQuoteIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ADMIN_THUMB_2X,
  buildMediaUrl,
  formatStoreDate,
  REVIEW_BODY_LIMIT,
  REVIEW_MEDIA_LIMIT,
  REVIEW_VIDEO_MAX_BYTES,
  REVIEW_VIDEO_MIME,
  type CustomerReviewDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MediaPickerDialog,
  type MediaUrlContext,
  type PickedImage,
} from '@/components/media/ProductImages';
import { useDirectUpload } from '@/components/media/useDirectUpload';
import {
  deleteCustomerReview,
  reorderCustomerReviews,
  saveCustomerReview,
  setCustomerReviewActive,
} from '@/app/(dashboard)/reviews/actions';
import { cn } from '@/lib/utils';

type FormMedia = {
  id: string;
  kind: 'image' | 'video';
  /** A resized library URL, the raw object for a video, or a local blob for a fresh upload. */
  src: string | null;
  filename: string;
};

/** What the shop's image uploads accept; the server holds the real list. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ACCEPT = [...IMAGE_TYPES, ...REVIEW_VIDEO_MIME].join(',');
const VIDEO_MB = Math.round(REVIEW_VIDEO_MAX_BYTES / 1024 / 1024);

const EMPTY = {
  id: undefined as string | undefined,
  customerName: '',
  customerPhone: '',
  /** 0 until chosen, so an untouched form cannot quietly post five stars. */
  rating: 0,
  body: '',
  isActive: true,
};

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-px" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <StarIcon
          key={value}
          aria-hidden
          className={cn(
            'size-3.5',
            value <= rating
              ? 'fill-[var(--warning)] text-[var(--warning)]'
              : 'text-muted-foreground/40',
          )}
        />
      ))}
    </span>
  );
}

function mediaSummary(row: CustomerReviewDto): string {
  const photos = row.media.filter((item) => item.kind === 'image').length;
  const videos = row.media.length - photos;
  const parts = [
    photos > 0 && `${photos} photo${photos === 1 ? '' : 's'}`,
    videos > 0 && `${videos} video${videos === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'No photos';
}

/** A square preview: the image, or a video's first frame under a play mark. */
function MediaTile({ item, className }: { item: FormMedia; className?: string }) {
  return (
    <span
      className={cn(
        'bg-muted relative block overflow-hidden rounded border',
        className,
      )}
    >
      {item.src ? (
        item.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.src} alt="" className="size-full object-cover" />
        ) : (
          <video
            src={`${item.src}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none size-full object-cover"
          />
        )
      ) : (
        <ImageIcon className="text-muted-foreground m-auto size-4" strokeWidth={1.5} />
      )}
      {item.kind === 'video' && (
        <span className="absolute inset-0 grid place-items-center bg-black/25">
          <PlayIcon className="size-4 fill-white text-white" aria-hidden />
        </span>
      )}
    </span>
  );
}

/**
 * Customer reviews: post, arrange, hide, delete.
 *
 * Laid out like the banners screen on purpose — a ranked list with a dialog —
 * because the question is the same one: what shows on the home page, and in
 * what order. The first few by position are what the home band shows.
 */
export function ReviewsManager({ rows, ctx }: { rows: CustomerReviewDto[]; ctx: MediaUrlContext }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [media, setMedia] = useState<FormMedia[]>([]);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<CustomerReviewDto | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /*
   * Fresh uploads preview from the bytes already in the browser: a video has no
   * resized thumbnail to fetch, and an image's would be one more round trip for
   * a file that is sitting right here. The URLs are released when the dialog
   * lets go of them.
   */
  const blobs = useRef<string[]>([]);
  const releaseBlobs = useCallback(() => {
    blobs.current.forEach((url) => URL.revokeObjectURL(url));
    blobs.current = [];
  }, []);
  useEffect(() => releaseBlobs, [releaseBlobs]);

  const onUploaded = useCallback(
    (_ids: string[], uploads: Array<{ mediaId: string; file: File }>) => {
      const added = uploads.map(({ mediaId, file }) => {
        const src = URL.createObjectURL(file);
        blobs.current.push(src);
        return {
          id: mediaId,
          kind: file.type.startsWith('video/') ? ('video' as const) : ('image' as const),
          src,
          filename: file.name,
        };
      });
      setMedia((current) => [...current, ...added].slice(0, REVIEW_MEDIA_LIMIT));
    },
    [],
  );

  const { items, isUploading, upload, clearSettled } = useDirectUpload({
    prefix: 'reviews',
    onUploaded,
  });
  const inFlight = items.filter((item) => item.status !== 'done');
  const pendingCount = items.filter(
    (item) => item.status !== 'done' && item.status !== 'error',
  ).length;
  const room = REVIEW_MEDIA_LIMIT - media.length - pendingCount;

  function urlFor(r2Key: string, kind: 'image' | 'video'): string | null {
    if (!ctx.publicBaseUrl) return null;
    // A video is served as stored; the resizing path is for images only.
    return kind === 'video'
      ? buildMediaUrl(ctx.publicBaseUrl, false, r2Key)
      : buildMediaUrl(ctx.publicBaseUrl, ctx.transformsEnabled, r2Key, { w: ADMIN_THUMB_2X });
  }

  function prepare() {
    releaseBlobs();
    clearSettled();
    setErrors({});
    setFormError(null);
  }

  function openNew() {
    prepare();
    setForm({ ...EMPTY });
    setMedia([]);
    setOpen(true);
  }

  function openEdit(row: CustomerReviewDto) {
    prepare();
    setForm({
      id: row.id,
      customerName: row.customerName,
      customerPhone: row.customerPhone ?? '',
      rating: row.rating,
      body: row.body,
      isActive: row.isActive,
    });
    setMedia(
      row.media.map((item) => ({
        id: item.id,
        kind: item.kind,
        src: urlFor(item.r2Key, item.kind),
        filename: item.filename,
      })),
    );
    setOpen(true);
  }

  /** Checked here only to fail fast with a useful message; the API re-checks all of it. */
  function pickFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (fileInput.current) fileInput.current.value = '';
    if (files.length === 0) return;

    const accepted: File[] = [];
    for (const file of files) {
      const type = file.type.toLowerCase();
      const isVideo = (REVIEW_VIDEO_MIME as readonly string[]).includes(type);
      if (!isVideo && !IMAGE_TYPES.includes(type)) {
        toast.error(`${file.name} is not a photo, or an MP4, WebM or MOV video.`);
      } else if (isVideo && file.size > REVIEW_VIDEO_MAX_BYTES) {
        toast.error(`${file.name} is over ${VIDEO_MB} MB. Trim the clip and try again.`);
      } else if (accepted.length >= room) {
        toast.error(`A review holds ${REVIEW_MEDIA_LIMIT} photos and videos at most.`);
        break;
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length > 0) void upload(accepted);
  }

  function addFromLibrary(picked: PickedImage[]) {
    const fresh = picked.filter((image) => !media.some((item) => item.id === image.id));
    if (fresh.length > room) {
      toast.error(`A review holds ${REVIEW_MEDIA_LIMIT} photos and videos at most.`);
    }
    setMedia((current) => [
      ...current,
      ...fresh.slice(0, Math.max(0, room)).map((image) => ({
        id: image.id,
        kind: 'image' as const,
        src: urlFor(image.r2Key, 'image'),
        filename: image.filename,
      })),
    ]);
    setPicking(false);
  }

  function moveMedia(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= media.length) return;
    setMedia((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function close() {
    setOpen(false);
    releaseBlobs();
  }

  function save() {
    setErrors({});
    setFormError(null);
    startSaving(async () => {
      const result = await saveCustomerReview({
        ...form,
        mediaIds: media.map((item) => item.id),
      });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success(form.id ? 'Review saved' : 'Review posted');
      close();
      router.refresh();
    });
  }

  function move(row: CustomerReviewDto, direction: -1 | 1) {
    const index = rows.findIndex((r) => r.id === row.id);
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    const next = [...rows];
    [next[index], next[target]] = [next[target]!, next[index]!];

    startSaving(async () => {
      const result = await reorderCustomerReviews({ ids: next.map((r) => r.id) });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not reorder.');
        return;
      }
      router.refresh();
    });
  }

  const error = (key: string) =>
    errors[key] ? <span className="text-xs text-[var(--critical-fg)]">{errors[key]}</span> : null;

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={openNew}>
          <PlusIcon className="size-4" />
          Post a review
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <MessageSquareQuoteIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <p className="font-medium">No reviews yet</p>
          <p className="text-muted-foreground max-w-[420px]">
            Post what customers tell you — on WhatsApp, on a call, at the counter — with their
            photos and videos of the delivery.
          </p>
          <Button type="button" className="mt-1" onClick={openNew}>
            <PlusIcon className="size-4" />
            Post your first review
          </Button>
        </div>
      ) : (
        <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          {rows.map((row, index) => {
            const lead = row.media[0];
            return (
              <li
                key={row.id}
                className={cn(
                  'flex items-start gap-3 border-b px-3 py-3 last:border-b-0',
                  !row.isActive && 'opacity-55',
                )}
              >
                <span className="flex shrink-0 flex-col pt-0.5">
                  <button
                    type="button"
                    onClick={() => move(row, -1)}
                    disabled={index === 0 || isSaving}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUpIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(row, 1)}
                    disabled={index === rows.length - 1 || isSaving}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDownIcon className="size-4" />
                  </button>
                </span>

                {lead ? (
                  <MediaTile
                    className="size-12 shrink-0"
                    item={{
                      id: lead.id,
                      kind: lead.kind,
                      src: urlFor(lead.r2Key, lead.kind),
                      filename: lead.filename,
                    }}
                  />
                ) : (
                  <span className="bg-muted text-muted-foreground grid size-12 shrink-0 place-items-center rounded border font-semibold">
                    {row.customerName.trim().charAt(0).toUpperCase()}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium">{row.customerName}</span>
                    {row.customerPhone && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-bg)] px-1.5 py-px text-[11px] font-medium text-[var(--success-fg)]">
                        <BadgeCheckIcon className="size-3" aria-hidden />
                        Verified
                      </span>
                    )}
                    <StarRow rating={row.rating} />
                  </span>
                  <span className="text-muted-foreground mt-0.5 line-clamp-2 block">{row.body}</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {mediaSummary(row)} · Posted {formatStoreDate(row.createdAt)}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-1.5">
                  <Switch
                    checked={row.isActive}
                    onCheckedChange={(next) =>
                      startSaving(async () => {
                        await setCustomerReviewActive({ id: row.id, isActive: next });
                        router.refresh();
                      })
                    }
                    aria-label="Show this review"
                  />
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    aria-label="Edit"
                  >
                    <PencilIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(row)}
                    className="text-muted-foreground p-1 hover:text-[var(--critical-fg)]"
                    aria-label="Delete"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit review' : 'Post a review'}</DialogTitle>
            <DialogDescription>
              Shown on the home page in the Customer reviews section, in the order set on this
              screen.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
              {formError}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-name">Customer name</Label>
              <Input
                id="r-name"
                value={form.customerName}
                onChange={(e) => setForm((c) => ({ ...c, customerName: e.target.value }))}
                placeholder="Ramesh Patel"
                aria-invalid={Boolean(errors.customerName)}
              />
              {error('customerName')}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-phone">Mobile number (optional)</Label>
              <Input
                id="r-phone"
                value={form.customerPhone}
                onChange={(e) => setForm((c) => ({ ...c, customerPhone: e.target.value }))}
                inputMode="tel"
                placeholder="98765 43210"
                aria-invalid={Boolean(errors.customerPhone)}
              />
              {error('customerPhone')}
            </div>

            <p className="text-muted-foreground -mt-1 flex items-start gap-1.5 text-xs sm:col-span-2">
              <BadgeCheckIcon className="mt-px size-3.5 shrink-0 text-[var(--success-fg)]" aria-hidden />
              A number adds a Verified customer badge to the review. The number itself never
              appears on the website.
            </p>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label id="r-rating-label">Rating</Label>
              <div role="radiogroup" aria-labelledby="r-rating-label" className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === value}
                    aria-label={`${value} star${value === 1 ? '' : 's'}`}
                    onClick={() => setForm((c) => ({ ...c, rating: value }))}
                    className="hover:bg-muted rounded p-0.5"
                  >
                    <StarIcon
                      aria-hidden
                      className={cn(
                        'size-7',
                        value <= form.rating
                          ? 'fill-[var(--warning)] text-[var(--warning)]'
                          : 'text-muted-foreground/40',
                      )}
                    />
                  </button>
                ))}
              </div>
              {error('rating')}
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="r-body">Review</Label>
                <span className="text-muted-foreground tabular text-xs">
                  {form.body.length} / {REVIEW_BODY_LIMIT}
                </span>
              </div>
              <Textarea
                id="r-body"
                rows={5}
                maxLength={REVIEW_BODY_LIMIT}
                value={form.body}
                onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))}
                placeholder="Ordered 40 bags of cement in the morning and they were on site by afternoon."
                aria-invalid={Boolean(errors.body)}
              />
              {error('body')}
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Photos and videos</Label>

              {media.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {media.map((item, index) => (
                    <li key={item.id} className="flex flex-col items-center gap-1">
                      <MediaTile item={item} className="size-[84px]" />
                      <span className="flex items-center">
                        <button
                          type="button"
                          onClick={() => moveMedia(index, -1)}
                          disabled={index === 0}
                          className="text-muted-foreground hover:text-foreground p-0.5 disabled:opacity-30"
                          aria-label={`Move ${item.filename} earlier`}
                        >
                          <ChevronLeftIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMedia((c) => c.filter((m) => m.id !== item.id))}
                          className="text-muted-foreground p-0.5 hover:text-[var(--critical-fg)]"
                          aria-label={`Remove ${item.filename}`}
                        >
                          <XIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMedia(index, 1)}
                          disabled={index === media.length - 1}
                          className="text-muted-foreground hover:text-foreground p-0.5 disabled:opacity-30"
                          aria-label={`Move ${item.filename} later`}
                        >
                          <ChevronRightIcon className="size-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {inFlight.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {inFlight.map((item) => (
                    <li key={item.localId} className="flex items-center gap-2 text-xs">
                      {item.status === 'error' ? (
                        <XIcon className="size-3.5 shrink-0 text-[var(--critical-fg)]" aria-hidden />
                      ) : (
                        <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
                      <span
                        className={cn(
                          'shrink-0',
                          item.status === 'error'
                            ? 'text-[var(--critical-fg)]'
                            : 'text-muted-foreground tabular',
                        )}
                      >
                        {item.status === 'error'
                          ? item.error
                          : item.status === 'confirming'
                            ? 'Finishing…'
                            : `${item.progress}%`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  hidden
                  onChange={(e) => pickFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={room <= 0}
                  onClick={() => fileInput.current?.click()}
                >
                  <UploadIcon className="size-4" />
                  Upload photos or videos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={room <= 0}
                  onClick={() => setPicking(true)}
                >
                  <ImageIcon className="size-4" />
                  Choose from library
                </Button>
              </div>
              <span className="text-muted-foreground text-xs">
                Up to {REVIEW_MEDIA_LIMIT}. Photos, or MP4, WebM and MOV videos up to {VIDEO_MB} MB.
                They appear on the review in this order.
              </span>
              {error('mediaIds')}
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 border-t pt-3">
            <span className="font-medium">Showing on the website</span>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((c) => ({ ...c, isActive: v }))}
            />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="button" disabled={isSaving || isUploading} onClick={save}>
              {(isSaving || isUploading) && <LoaderCircleIcon className="size-4 animate-spin" />}
              {isUploading ? 'Uploading…' : form.id ? 'Save review' : 'Post review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPickerDialog
        open={picking}
        onOpenChange={(next) => !next && setPicking(false)}
        ctx={ctx}
        alreadyPicked={[]}
        onConfirm={addFromLibrary}
      />

      <Dialog open={confirmDelete !== null} onOpenChange={(n) => !n && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete this review?</DialogTitle>
            <DialogDescription>
              It comes off the website straight away. Its photos and videos stay in the media
              library. To take it down for now instead, switch it off.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving}
              onClick={() =>
                confirmDelete &&
                startSaving(async () => {
                  const result = await deleteCustomerReview({ id: confirmDelete.id });
                  if (!result.ok) {
                    toast.error(result.formErrors[0] ?? 'Could not delete that.');
                    return;
                  }
                  toast.success('Review deleted');
                  setConfirmDelete(null);
                  router.refresh();
                })
              }
            >
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
