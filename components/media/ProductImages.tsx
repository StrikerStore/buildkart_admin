'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ImageIcon, XIcon, UploadIcon, LoaderCircleIcon, SearchIcon, CheckIcon } from 'lucide-react';
import { buildMediaUrl, ADMIN_THUMB_2X } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useDirectUpload } from './useDirectUpload';

/*
 * Both shapes live in `@StrikerStore/contract`: a media id and a CDN base URL carry
 * no secret and need no database, so an app that only renders an `<img>` should
 * not have to reach for either. Re-exported here so the existing importers of
 * this module keep working unchanged.
 */
import type { MediaImageDto, MediaUrlContext } from '@StrikerStore/contract';

export type PickedImage = MediaImageDto;
export type { MediaUrlContext };

function thumbUrl(ctx: MediaUrlContext, r2Key: string, width = ADMIN_THUMB_2X): string | null {
  if (!ctx.publicBaseUrl) return null;
  return buildMediaUrl(ctx.publicBaseUrl, ctx.transformsEnabled, r2Key, { w: width });
}

function SortableThumb({
  image,
  ctx,
  onRemove,
  isPrimary,
}: {
  image: PickedImage;
  ctx: MediaUrlContext;
  onRemove: () => void;
  isPrimary: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });
  const src = thumbUrl(ctx, image.r2Key);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group bg-card relative aspect-square overflow-hidden rounded-md border',
        isDragging && 'z-10 shadow-[var(--shadow-popover)]',
      )}
    >
      <button
        type="button"
        className="size-full cursor-grab active:cursor-grabbing"
        aria-label={`Reorder ${image.filename}`}
        {...attributes}
        {...listeners}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={image.altTextEn ?? ''} className="size-full object-cover" />
        ) : (
          <span className="bg-muted flex size-full items-center justify-center">
            <ImageIcon className="text-muted-foreground size-5" strokeWidth={1.5} />
          </span>
        )}
      </button>

      {/* The storefront uses the first image as the card thumbnail, so which one
          leads is a real decision — label it rather than leaving it implicit. */}
      {isPrimary && (
        <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-[var(--nav)]/85 px-1.5 py-0.5 text-[10px] font-medium text-white">
          Main
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${image.filename}`}
        className="absolute top-1 right-1 rounded-full bg-[var(--nav)]/85 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <XIcon className="size-3.5" />
      </button>
    </li>
  );
}

export function ProductImages({
  value,
  onChange,
  ctx,
}: {
  value: PickedImage[];
  onChange: (next: PickedImage[]) => void;
  ctx: MediaUrlContext;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { items: uploads, isUploading, upload, clearFinished } = useDirectUpload({
    prefix: 'products',
    onUploaded: async (mediaIds) => {
      // Fetch the rows we just created so the grid renders them immediately
      // rather than waiting for a page refresh. The list is newest-first, so a
      // just-finished batch is always on the first page.
      const response = await fetch('/api/media/list');
      if (response.ok) {
        const { items } = (await response.json()) as { items: PickedImage[] };
        const fresh = items.filter((i) => mediaIds.includes(i.id));
        onChange([...value, ...fresh.filter((f) => !value.some((v) => v.id === f.id))]);
      }
      clearFinished();
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = value.findIndex((i) => i.id === active.id);
    const to = value.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;
    onChange(arrayMove(value, from, to));
  }

  const inFlight = uploads.filter((u) => u.status !== 'done');

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value.map((i) => i.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {value.map((image, index) => (
                <SortableThumb
                  key={image.id}
                  image={image}
                  ctx={ctx}
                  isPrimary={index === 0}
                  onRemove={() => onChange(value.filter((i) => i.id !== image.id))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {inFlight.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {inFlight.map((item) => (
            <li key={item.localId} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
              {item.status === 'error' ? (
                <span className="text-[var(--critical-fg)]">{item.error}</span>
              ) : (
                <span className="text-muted-foreground tabular">{item.progress}%</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <UploadIcon className="size-4" />
          )}
          Upload
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <ImageIcon className="size-4" />
          Choose from library
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

      {value.length > 1 && (
        <p className="text-muted-foreground text-xs">
          Drag to reorder. The first image is what customers see on the product card.
        </p>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        ctx={ctx}
        alreadyPicked={value}
        onConfirm={(picked) => {
          const additions = picked.filter((p) => !value.some((v) => v.id === p.id));
          onChange([...value, ...additions]);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  ctx,
  alreadyPicked,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: MediaUrlContext;
  alreadyPicked: PickedImage[];
  onConfirm: (picked: PickedImage[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PickedImage[]>([]);
  const [selected, setSelected] = useState<Record<string, PickedImage>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/media/list?q=${encodeURIComponent(q)}`);
      if (response.ok) {
        const { items: fetched } = (await response.json()) as { items: PickedImage[] };
        setItems(fetched);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected({});
    // Debounced so typing does not fire a request per keystroke.
    const timer = setTimeout(() => void load(query), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, query, load]);

  const selectedList = Object.values(selected);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Choose images</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by file name"
            className="pl-8"
          />
        </div>

        <div className="max-h-[380px] min-h-[200px] overflow-y-auto">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
              <LoaderCircleIcon className="size-4 animate-spin" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center">
              {query ? 'No images match that search.' : 'No images in the library yet.'}
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {items.map((item) => {
                const isSelected = Boolean(selected[item.id]);
                const isUsed = alreadyPicked.some((p) => p.id === item.id);
                const src = thumbUrl(ctx, item.r2Key);

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={isUsed}
                      onClick={() =>
                        setSelected((current) => {
                          const next = { ...current };
                          if (next[item.id]) delete next[item.id];
                          else next[item.id] = item;
                          return next;
                        })
                      }
                      /* The full name on hover: two lines of an 11px caption
                         cannot hold "banner-home-strip-mobile-v2.png". */
                      title={item.filename}
                      className={cn(
                        'block w-full text-left transition-all',
                        isUsed && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      <span
                        className={cn(
                          'relative block aspect-square w-full overflow-hidden rounded-md border',
                          isSelected && 'ring-2 ring-[var(--ring)] ring-offset-1',
                        )}
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
                          <span className="bg-muted flex size-full items-center justify-center">
                            <ImageIcon className="text-muted-foreground size-5" strokeWidth={1.5} />
                          </span>
                        )}

                        {isSelected && (
                          <span className="absolute top-1 right-1 rounded-full bg-[var(--ring)] p-0.5 text-white">
                            <CheckIcon className="size-3" />
                          </span>
                        )}
                        {isUsed && (
                          <span className="absolute inset-x-0 bottom-0 bg-[var(--nav)]/80 py-0.5 text-center text-[10px] text-white">
                            Added
                          </span>
                        )}
                      </span>

                      {/*
                        * The file name, under the thumbnail.
                        *
                        * The tiles are square and `object-cover`, so a wide
                        * banner shows as its middle third — four artworks from
                        * the same set are then near-identical crops. The name is
                        * the only thing that tells them apart, and it is what the
                        * search box above matches on.
                        *
                        * `break-all` because these are file names: they have no
                        * spaces to wrap at, and a name that cannot wrap either
                        * overflows the tile or renders as one useless word.
                        */}
                      <span className="text-muted-foreground mt-1 block line-clamp-2 text-[11px] leading-tight break-all">
                        {item.filename}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selectedList.length === 0}
            onClick={() => onConfirm(selectedList)}
          >
            Add {selectedList.length > 0 ? selectedList.length : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
