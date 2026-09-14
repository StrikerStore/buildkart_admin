'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LayoutTemplateIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  HOMEPAGE_SECTION_HINTS,
  HOMEPAGE_SECTION_LABELS,
  HOMEPAGE_SECTION_TYPES,
  TRUST_MARKERS,
  TRUST_MARKER_HINTS,
  TRUST_MARKER_LABELS,
  type HomepageSectionType,
  type TrustMarker,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
  deleteHomepageSection,
  reorderHomepageSections,
  saveHomepageSection,
  setHomepageSectionActive,
} from '@/app/(dashboard)/homepage/actions';
import { cn } from '@/lib/utils';
import type { HomepageSectionDto } from '@StrikerStore/contract';

type Option = { id: string; label: string };

const EMPTY = {
  id: undefined as string | undefined,
  type: 'CATEGORY_GRID' as HomepageSectionType,
  titleEn: '',
  titleHi: '',
  categoryIds: [] as string[],
  productIds: [] as string[],
  tagSlug: '',
  limit: '12',
  markers: [...TRUST_MARKERS] as TrustMarker[],
  isActive: true,
};

function Picker({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{title}</Label>
      <ul className="max-h-[180px] overflow-y-auto rounded-md border p-1.5">
        {options.length === 0 && (
          <li className="text-muted-foreground px-1.5 py-1 text-xs">Nothing to choose yet.</li>
        )}
        {options.map((option) => (
          <li key={option.id}>
            <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1.5 py-1">
              <Checkbox
                checked={selected.includes(option.id)}
                onCheckedChange={() => onToggle(option.id)}
              />
              <span className="truncate">{option.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HomepageManager({
  rows,
  categories,
  products,
  tags,
}: {
  rows: HomepageSectionDto[];
  categories: Option[];
  products: Option[];
  /** Public, active tags only, by slug — see `HomepageSectionOptionsDto`. */
  tags: Array<{ slug: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  /*
   * There is no per-field error state here on purpose: this form surfaces one
   * message at a time, falling back to `fieldErrors.config` when the failure is
   * about the section's configuration. Collecting per-field errors that nothing
   * renders was write-only state pretending to be a feature.
   */
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<HomepageSectionDto | null>(null);

  function openNew() {
    setForm({ ...EMPTY });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(row: HomepageSectionDto) {
    setForm({
      id: row.id,
      type: row.type,
      titleEn: row.titleEn ?? '',
      titleHi: row.titleHi ?? '',
      categoryIds: row.categoryIds,
      productIds: row.productIds,
      tagSlug: row.tagSlug ?? '',
      limit: String(row.limit),
      markers: row.markers,
      isActive: row.isActive,
    });
    setFormError(null);
    setOpen(true);
  }

  function toggle(key: 'categoryIds' | 'productIds', id: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id)
        ? current[key].filter((value) => value !== id)
        : [...current[key], id],
    }));
  }

  /*
   * Kept in `TRUST_MARKERS` order rather than tick order. The strip is a fixed
   * row of four; letting the order follow the clicks would mean the preview in
   * the list and the live page disagreed for no reason the owner could see.
   */
  function toggleMarker(marker: TrustMarker) {
    setForm((current) => ({
      ...current,
      markers: TRUST_MARKERS.filter((value) =>
        value === marker ? !current.markers.includes(value) : current.markers.includes(value),
      ),
    }));
  }

  function save() {
    setFormError(null);
    startSaving(async () => {
      const result = await saveHomepageSection({
        id: form.id,
        type: form.type,
        titleEn: form.titleEn,
        titleHi: form.titleHi,
        isActive: form.isActive,
        config: {
          categoryIds: form.categoryIds,
          productIds: form.productIds,
          tagSlug: form.tagSlug === '' ? undefined : form.tagSlug,
          limit: form.limit,
          markers: form.markers,
        },
      });
      if (!result.ok) {
        setFormError(result.formErrors[0] ?? result.fieldErrors.config ?? null);
        toast.error(result.formErrors[0] ?? result.fieldErrors.config ?? 'Check the form.');
        return;
      }
      toast.success('Section saved');
      setOpen(false);
      router.refresh();
    });
  }

  function move(row: HomepageSectionDto, direction: -1 | 1) {
    const index = rows.findIndex((r) => r.id === row.id);
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    const next = [...rows];
    [next[index], next[target]] = [next[target]!, next[index]!];

    startSaving(async () => {
      const result = await reorderHomepageSections({ ids: next.map((r) => r.id) });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not reorder.');
        return;
      }
      router.refresh();
    });
  }

  function summarise(row: HomepageSectionDto): string {
    switch (row.type) {
      case 'CATEGORY_GRID':
        return `${row.categoryIds.length} categor${row.categoryIds.length === 1 ? 'y' : 'ies'}`;
      case 'PRODUCT_CAROUSEL':
        return `${row.productIds.length} product${row.productIds.length === 1 ? '' : 's'}`;
      case 'TAG_CAROUSEL': {
        const tag = tags.find((t) => t.slug === row.tagSlug);
        return tag ? `Tagged "${tag.label}", up to ${row.limit}` : 'Tag missing';
      }
      case 'TRUST_STRIP':
        return row.markers.map((marker) => TRUST_MARKER_LABELS[marker]).join(' · ');
      default:
        return HOMEPAGE_SECTION_HINTS[row.type];
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={openNew}>
          <PlusIcon className="size-4" />
          Add section
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <LayoutTemplateIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <p className="font-medium">The homepage is empty</p>
          <p className="text-muted-foreground max-w-[420px]">
            Sections stack down the page in the order you set here.
          </p>
          <Button type="button" className="mt-1" onClick={openNew}>
            <PlusIcon className="size-4" />
            Add your first section
          </Button>
        </div>
      ) : (
        <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          {rows.map((row, index) => (
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
                  disabled={index === rows.length - 1 || isSaving}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDownIcon className="size-4" />
                </button>
              </span>

              <span className="text-muted-foreground tabular w-6 shrink-0 text-center text-xs">
                {index + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {row.titleEn ?? HOMEPAGE_SECTION_LABELS[row.type]}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {HOMEPAGE_SECTION_LABELS[row.type]} · {summarise(row)}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-1.5">
                <Switch
                  checked={row.isActive}
                  onCheckedChange={(next) =>
                    startSaving(async () => {
                      await setHomepageSectionActive({ id: row.id, isActive: next });
                      router.refresh();
                    })
                  }
                  aria-label="Show this section"
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
      )}

      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit section' : 'Add section'}</DialogTitle>
            <DialogDescription>{HOMEPAGE_SECTION_HINTS[form.type]}</DialogDescription>
          </DialogHeader>

          {formError && (
            <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((c) => ({ ...c, type: v as HomepageSectionType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOMEPAGE_SECTION_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {HOMEPAGE_SECTION_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* The trust strip is a full-bleed rule between bands and draws no
              heading, so it is not asked for one. */}
          <div
            className={cn('grid gap-3 sm:grid-cols-2', form.type === 'TRUST_STRIP' && 'hidden')}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-title">Heading</Label>
              <Input
                id="s-title"
                value={form.titleEn}
                onChange={(e) => setForm((c) => ({ ...c, titleEn: e.target.value }))}
                placeholder="Shop by category"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-title-hi">Heading (Hindi)</Label>
              <Input
                id="s-title-hi"
                value={form.titleHi}
                onChange={(e) => setForm((c) => ({ ...c, titleHi: e.target.value }))}
              />
            </div>
          </div>

          {/* Only the controls the chosen type actually uses are shown, so the
              form never asks for a setting that would be thrown away. */}
          {form.type === 'CATEGORY_GRID' && (
            <Picker
              title="Categories"
              options={categories}
              selected={form.categoryIds}
              onToggle={(id) => toggle('categoryIds', id)}
            />
          )}

          {form.type === 'PRODUCT_CAROUSEL' && (
            <Picker
              title="Products"
              options={products}
              selected={form.productIds}
              onToggle={(id) => toggle('productIds', id)}
            />
          )}

          {form.type === 'TAG_CAROUSEL' && (
            <div className="flex flex-col gap-1.5">
              <Label>Tag</Label>
              <Select
                value={form.tagSlug}
                onValueChange={(value) => setForm((c) => ({ ...c, tagSlug: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((tag) => (
                    <SelectItem key={tag.slug} value={tag.slug}>
                      {tag.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-xs">
                The section fills itself from the tag, so it stays current without being edited.
                Only public tags are listed — internal ones never appear on the storefront.
              </span>
            </div>
          )}

          {form.type === 'TRUST_STRIP' && (
            <div className="flex flex-col gap-1.5">
              <Label>Promises to show</Label>
              <ul className="flex flex-col rounded-md border p-1.5">
                {TRUST_MARKERS.map((marker) => (
                  <li key={marker}>
                    <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-2 rounded px-1.5 py-1.5">
                      <Checkbox
                        className="mt-0.5"
                        checked={form.markers.includes(marker)}
                        onCheckedChange={() => toggleMarker(marker)}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span>{TRUST_MARKER_LABELS[marker]}</span>
                        <span className="text-muted-foreground text-xs">
                          {TRUST_MARKER_HINTS[marker]}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <span className="text-muted-foreground text-xs">
                The wording is not editable on purpose — each promise is read from Settings, so it
                cannot say something the shop has stopped doing.
              </span>
            </div>
          )}

          {(form.type === 'TAG_CAROUSEL' || form.type === 'RATE_TICKER') && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-limit">Show at most</Label>
              <Input
                id="s-limit"
                value={form.limit}
                onChange={(e) =>
                  setForm((c) => ({ ...c, limit: e.target.value.replace(/\D/g, '') }))
                }
                inputMode="numeric"
                className="tabular w-[100px]"
              />
            </div>
          )}

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
            <Button type="button" disabled={isSaving} onClick={save}>
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              {form.id ? 'Save section' : 'Add section'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(n) => !n && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Remove this section?</DialogTitle>
            <DialogDescription>
              It disappears from the homepage. The products and categories it pointed at are
              untouched.
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
                  const result = await deleteHomepageSection({
                    id: confirmDelete.id,
                    isActive: false,
                  });
                  if (!result.ok) {
                    toast.error(result.formErrors[0] ?? 'Could not remove that.');
                    return;
                  }
                  toast.success('Section removed');
                  setConfirmDelete(null);
                  router.refresh();
                })
              }
            >
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
