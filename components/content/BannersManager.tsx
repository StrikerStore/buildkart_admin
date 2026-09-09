'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ImageIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  buildMediaUrl,
  formatStoreDate,
  ADMIN_THUMB_2X,
  BANNER_PLACEMENTS,
  BANNER_PLACEMENTS_NOT_LIVE,
  BANNER_PLACEMENT_HINTS,
  BANNER_PLACEMENT_LABELS,
  BANNER_PLACEMENT_SIZES,
  type BannerPlacement,
} from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  deleteBanner,
  reorderBanners,
  saveBanner,
  setBannerActive,
} from '@/app/(dashboard)/banners/actions';
import { cn } from '@/lib/utils';
import type { BannerDto } from '@buildkart/contract';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EMPTY = {
  id: undefined as string | undefined,
  titleEn: '',
  titleHi: '',
  linkUrl: '',
  placement: 'HOME_HERO' as BannerPlacement,
  isActive: true,
  startsAt: '',
  endsAt: '',
};

/**
 * What a placement is, what to upload for it, and whether the storefront shows
 * it yet.
 *
 * The sizes matter more here than they look. The storefront sizes every banner
 * slot by aspect ratio, so artwork at the wrong ratio does not crop to fit — it
 * changes the shape of the slot. This is the only screen where the owner ever
 * finds out what those ratios are.
 */
function PlacementGuide({ placement }: { placement: BannerPlacement }) {
  const size = BANNER_PLACEMENT_SIZES[placement];
  const live = !BANNER_PLACEMENTS_NOT_LIVE.includes(placement);

  return (
    <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
      <p>{BANNER_PLACEMENT_HINTS[placement]}</p>
      <p>
        Desktop <strong className="font-medium">{size.desktop}</strong> · mobile{' '}
        <strong className="font-medium">{size.mobile}</strong>
      </p>
      {!live && (
        <p className="text-[var(--warning-fg)]">
          The storefront has no slot for this yet — anything here stays hidden.
        </p>
      )}
    </div>
  );
}

export function BannersManager({ rows, ctx }: { rows: BannerDto[]; ctx: MediaUrlContext }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [desktop, setDesktop] = useState<PickedImage | null>(null);
  const [mobile, setMobile] = useState<PickedImage | null>(null);
  const [picking, setPicking] = useState<'desktop' | 'mobile' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<BannerDto | null>(null);

  const thumb = (image: PickedImage | null, width = ADMIN_THUMB_2X) =>
    image && ctx.publicBaseUrl
      ? buildMediaUrl(ctx.publicBaseUrl, ctx.transformsEnabled, image.r2Key, { w: width })
      : null;

  function openNew() {
    setForm({ ...EMPTY });
    setDesktop(null);
    setMobile(null);
    setErrors({});
    setOpen(true);
  }

  function openEdit(row: BannerDto) {
    setForm({
      id: row.id,
      titleEn: row.titleEn ?? '',
      titleHi: row.titleHi ?? '',
      linkUrl: row.linkUrl ?? '',
      placement: row.placement,
      isActive: row.isActive,
      startsAt: toLocalInput(row.startsAt),
      endsAt: toLocalInput(row.endsAt),
    });
    setDesktop(row.mediaDesktop);
    setMobile(row.mediaMobile);
    setErrors({});
    setOpen(true);
  }

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveBanner({
        ...form,
        mediaIdDesktop: desktop?.id ?? '',
        mediaIdMobile: mobile?.id ?? '',
      });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Banner saved');
      setOpen(false);
      router.refresh();
    });
  }

  function move(row: BannerDto, direction: -1 | 1) {
    // Reordering is within a placement: a home hero and a category banner are
    // never in the same running order.
    const siblings = rows.filter((r) => r.placement === row.placement);
    const index = siblings.findIndex((r) => r.id === row.id);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;

    const next = [...siblings];
    [next[index], next[target]] = [next[target]!, next[index]!];

    startSaving(async () => {
      const result = await reorderBanners({ ids: next.map((r) => r.id) });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not reorder.');
        return;
      }
      router.refresh();
    });
  }

  const byPlacement = BANNER_PLACEMENTS.map((placement) => ({
    placement,
    items: rows.filter((row) => row.placement === placement),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={openNew}>
          <PlusIcon className="size-4" />
          Add banner
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <ImageIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <p className="font-medium">No banners yet</p>
          <p className="text-muted-foreground max-w-[420px]">
            Upload artwork to the media library first, then place it here.
          </p>
          <Button type="button" className="mt-1" onClick={openNew}>
            <PlusIcon className="size-4" />
            Add your first banner
          </Button>
        </div>
      ) : (
        byPlacement.map((group) => (
          <section key={group.placement} className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-semibold">{BANNER_PLACEMENT_LABELS[group.placement]}</h2>
              <PlacementGuide placement={group.placement} />
            </div>
            <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
              {group.items.map((row, index) => (
                <li
                  key={row.id}
                  className={cn(
                    'flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0',
                    !row.isActive && 'opacity-55',
                  )}
                >
                  <span className="flex shrink-0 flex-col">
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
                      disabled={index === group.items.length - 1 || isSaving}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDownIcon className="size-4" />
                    </button>
                  </span>

                  <span className="bg-muted h-11 w-[88px] shrink-0 overflow-hidden rounded border">
                    {thumb(row.mediaDesktop) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb(row.mediaDesktop)!}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {row.titleEn ?? row.mediaDesktop.filename}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {row.mediaMobile ? 'Desktop + mobile artwork' : 'Desktop artwork only'}
                      {row.linkUrl && ` · links to ${row.linkUrl}`}
                    </span>
                  </span>

                  <span className="text-muted-foreground hidden w-[150px] shrink-0 text-xs sm:block">
                    {row.startsAt || row.endsAt ? (
                      <>
                        {row.startsAt ? formatStoreDate(row.startsAt) : 'Now'}
                        {row.endsAt ? ` – ${formatStoreDate(row.endsAt)}` : ' onwards'}
                      </>
                    ) : (
                      'Always'
                    )}
                  </span>

                  <span className="flex shrink-0 items-center gap-1.5">
                    <Switch
                      checked={row.isActive}
                      onCheckedChange={(next) =>
                        startSaving(async () => {
                          await setBannerActive({ id: row.id, isActive: next });
                          router.refresh();
                        })
                      }
                      aria-label="Show this banner"
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
              ))}
            </ul>
          </section>
        ))
      )}

      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit banner' : 'Add banner'}</DialogTitle>
            <DialogDescription>
              Separate artwork per breakpoint: a wide desktop hero crops badly on a phone, and this
              audience is overwhelmingly on phones.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            {(['desktop', 'mobile'] as const).map((which) => {
              const image = which === 'desktop' ? desktop : mobile;
              return (
                <div key={which} className="flex flex-col gap-1.5">
                  <Label>{which === 'desktop' ? 'Desktop image' : 'Mobile image (optional)'}</Label>
                  <button
                    type="button"
                    onClick={() => setPicking(which)}
                    className="hover:bg-muted/50 bg-muted flex h-[92px] items-center justify-center overflow-hidden rounded-md border transition-colors"
                  >
                    {thumb(image, 320) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb(image, 320)!} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
                        <ImageIcon className="size-5" strokeWidth={1.5} />
                        Choose image
                      </span>
                    )}
                  </button>
                  {which === 'desktop' && errors.mediaIdDesktop && (
                    <span className="text-xs text-[var(--critical-fg)]">
                      {errors.mediaIdDesktop}
                    </span>
                  )}
                  {image && (
                    <button
                      type="button"
                      onClick={() => (which === 'desktop' ? setDesktop(null) : setMobile(null))}
                      className="text-muted-foreground hover:text-foreground self-start text-xs underline-offset-2 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-title">Title</Label>
              <Input
                id="b-title"
                value={form.titleEn}
                onChange={(e) => setForm((c) => ({ ...c, titleEn: e.target.value }))}
                placeholder="Monsoon waterproofing"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-title-hi">Title (Hindi)</Label>
              <Input
                id="b-title-hi"
                value={form.titleHi}
                onChange={(e) => setForm((c) => ({ ...c, titleHi: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="b-link">Links to</Label>
              <Input
                id="b-link"
                value={form.linkUrl}
                onChange={(e) => setForm((c) => ({ ...c, linkUrl: e.target.value }))}
                placeholder="/category/cement"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Placement</Label>
              <Select
                value={form.placement}
                onValueChange={(v) => setForm((c) => ({ ...c, placement: v as BannerPlacement }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANNER_PLACEMENTS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {BANNER_PLACEMENT_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* The sizes belong beside the picker, not only in the list
                  behind this dialog: by the time somebody is choosing a
                  placement they have usually already cropped the artwork. */}
              <PlacementGuide placement={form.placement} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-starts">Starts</Label>
              <Input
                id="b-starts"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((c) => ({ ...c, startsAt: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-ends">Ends</Label>
              <Input
                id="b-ends"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((c) => ({ ...c, endsAt: e.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 border-t pt-3">
            <span className="font-medium">Showing</span>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((c) => ({ ...c, isActive: v }))}
            />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSaving || !desktop} onClick={save}>
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              {form.id ? 'Save banner' : 'Add banner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPickerDialog
        open={picking !== null}
        onOpenChange={(next) => !next && setPicking(null)}
        ctx={ctx}
        alreadyPicked={[]}
        onConfirm={(picked) => {
          // The library picker allows a multi-select; a banner has one slot, so
          // the first choice wins rather than silently dropping the rest.
          const first = picked[0];
          if (first) {
            if (picking === 'desktop') setDesktop(first);
            else setMobile(first);
          }
          setPicking(null);
        }}
      />

      <Dialog open={confirmDelete !== null} onOpenChange={(n) => !n && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete this banner?</DialogTitle>
            <DialogDescription>
              The artwork stays in the media library — only the placement goes.
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
                  const result = await deleteBanner({ id: confirmDelete.id, isActive: false });
                  if (!result.ok) {
                    toast.error(result.formErrors[0] ?? 'Could not delete that.');
                    return;
                  }
                  toast.success('Banner deleted');
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
