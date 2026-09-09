'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircleIcon, ImageIcon, LoaderCircleIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { scrollMainToTop } from '@/lib/scroll';
import { slugify, buildMediaUrl, ADMIN_THUMB_2X } from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TranslatableField } from '@/components/form/TranslatableField';
import { CategoryRuleBuilder, type RuleTagOption } from './CategoryRuleBuilder';
import {
  MediaPickerDialog,
  type MediaUrlContext,
  type PickedImage,
} from '@/components/media/ProductImages';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import type { CategoryMatch, TagRule } from '@buildkart/contract';
import { createCategory, updateCategory, deleteCategory } from '@/app/(dashboard)/categories/actions';
import type { CategoryDto } from '@buildkart/contract';

/** `null` id means this is the create form. */
export type CategoryFormInitial = {
  id: string | null;
  nameEn: string;
  nameHi: string;
  slug: string;
  descriptionEn: string;
  descriptionHi: string;
  parentId: string | null;
  image: PickedImage | null;
  isActive: boolean;
  isRateVolatile: boolean;
  seoTitle: string;
  seoDescription: string;
  productCount: number;
  childCount: number;
  autoMatch: CategoryMatch;
  autoRules: TagRule[];
};

const NO_PARENT = '__root__';

export function CategoryForm({
  initial,
  parentOptions,
  tags,
  ctx,
}: {
  initial: CategoryFormInitial;
  parentOptions: Pick<CategoryDto, 'id' | 'nameEn'>[];
  tags: RuleTagOption[];
  ctx: MediaUrlContext;
}) {
  const router = useRouter();
  const isEdit = initial.id !== null;

  const [nameEn, setNameEn] = useState(initial.nameEn);
  const [nameHi, setNameHi] = useState(initial.nameHi);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [descriptionEn, setDescriptionEn] = useState(initial.descriptionEn);
  const [descriptionHi, setDescriptionHi] = useState(initial.descriptionHi);
  const [parentId, setParentId] = useState(initial.parentId ?? NO_PARENT);
  const [image, setImage] = useState<PickedImage | null>(initial.image);
  const [picking, setPicking] = useState(false);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [isRateVolatile, setIsRateVolatile] = useState(initial.isRateVolatile);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);
  const [autoMatch, setAutoMatch] = useState<CategoryMatch>(initial.autoMatch);
  const [autoRules, setAutoRules] = useState<TagRule[]>(initial.autoRules);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  /**
   * The slug tracks the English name until the moment it is edited by hand.
   * On an existing category it never auto-follows: the slug is already a live
   * storefront URL, and silently rewriting it on a rename would break links.
   */
  function onNameEnChange(value: string) {
    setNameEn(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const payload = {
      nameEn,
      nameHi,
      slug,
      descriptionEn,
      descriptionHi,
      parentId: parentId === NO_PARENT ? null : parentId,
      imageMediaId: image?.id ?? null,
      isActive,
      isRateVolatile,
      seoTitle,
      seoDescription,
      autoMatch,
      autoRules,
    };

    startSaving(async () => {
      const result = initial.id
        ? await updateCategory(initial.id, payload)
        : await createCategory(payload);

      if (!result.ok) {
        setFormError(result.formErrors[0] ?? null);
        setFieldErrors(result.fieldErrors);
        if (Object.keys(result.fieldErrors).length === 0 && !result.formErrors[0]) {
          setFormError('Could not save this category.');
        }
        return;
      }

      toast.success(isEdit ? 'Category updated' : 'Category created');
      router.push('/categories');
      router.refresh();
    });
  }

  function onDelete() {
    if (!initial.id) return;
    const confirmed = window.confirm(
      `Delete “${initial.nameEn}”? This cannot be undone.`,
    );
    if (!confirmed) return;

    startDeleting(async () => {
      const result = await deleteCategory(initial.id!);
      if (!result.ok) {
        // Blocked deletes explain exactly what is in the way, so surface it
        // where the eye already is rather than in a toast that vanishes.
        setFormError(result.formErrors[0] ?? 'Could not delete this category.');
        scrollMainToTop();
        return;
      }
      toast.success('Category deleted');
      router.push('/categories');
      router.refresh();
    });
  }

  const busy = isSaving || isDeleting;

  const thumb =
    image && ctx.publicBaseUrl
      ? buildMediaUrl(ctx.publicBaseUrl, ctx.transformsEnabled, image.r2Key, {
          w: ADMIN_THUMB_2X,
        })
      : null;

  return (
    <form onSubmit={onSubmit}>
      <PageContainer narrow>
        <PageHeader
          title={isEdit ? initial.nameEn || 'Edit category' : 'New category'}
          backHref="/categories"
          backLabel="Categories"
          actions={
            <>
              {isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDelete}
                  disabled={busy}
                  className="text-[var(--critical-fg)] hover:text-[var(--critical-fg)]"
                >
                  <Trash2Icon className="size-4" />
                  Delete
                </Button>
              )}
              <Button type="submit" disabled={busy}>
                {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        />

        {formError && (
          <Alert
            variant="destructive"
            className="mb-4 border-[var(--critical-fg)]/20 bg-[var(--critical-bg)]"
          >
            <AlertCircleIcon className="size-4" />
            <AlertDescription className="text-[var(--critical-fg)]">{formError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
            <TranslatableField
              label="Name"
              required
              valueEn={nameEn}
              valueHi={nameHi}
              onChangeEn={onNameEnChange}
              onChangeHi={setNameHi}
              placeholder="Cement"
              errorEn={fieldErrors.nameEn}
              maxLength={255}
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Storefront URL</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  buildkart.co/c/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  placeholder="cement"
                  className="font-mono"
                  aria-invalid={Boolean(fieldErrors.slug)}
                />
              </div>
              {fieldErrors.slug ? (
                <p className="text-[var(--critical-fg)] text-xs">{fieldErrors.slug}</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {isEdit
                    ? 'Changing this breaks any existing links to the category.'
                    : 'Filled in automatically from the English name.'}
                </p>
              )}
            </div>

            <TranslatableField
              label="Description"
              multiline
              valueEn={descriptionEn}
              valueHi={descriptionHi}
              onChangeEn={setDescriptionEn}
              onChangeHi={setDescriptionHi}
              helpText="Shown at the top of the category page. Optional."
              maxLength={5000}
            />

            {/*
              * The tile picture.
              *
              * Square, because the storefront tile is `aspect-square` with
              * `object-cover` — a wide crop loses its left and right thirds
              * rather than shrinking to fit. Without one the tile falls back to
              * the first letter of the name, which distinguishes one tile from
              * the next but is not what anybody wants to ship.
              */}
            <div className="flex flex-col gap-1.5 border-t pt-4">
              <Label>Tile image</Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="hover:bg-muted/50 bg-muted grid size-[92px] shrink-0 place-items-center overflow-hidden rounded-md border transition-colors"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
                      <ImageIcon className="size-5" strokeWidth={1.5} />
                      Choose
                    </span>
                  )}
                </button>
                <div className="text-muted-foreground flex flex-col items-start gap-1 text-xs">
                  <p>
                    Shown on the tile for this category on the storefront. Square,{' '}
                    <strong className="font-medium">400 × 400</strong> or larger.
                  </p>
                  <p>Without one the tile shows the first letter of the name instead.</p>
                  {image && (
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="hover:text-foreground underline-offset-2 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {fieldErrors.imageMediaId && (
                <p className="text-[var(--critical-fg)] text-xs">{fieldErrors.imageMediaId}</p>
              )}
            </div>
          </section>

          <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
            <h2 className="font-semibold">Organisation</h2>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="parent">Parent category</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger id="parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>None — top level</SelectItem>
                  {parentOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.parentId && (
                <p className="text-[var(--critical-fg)] text-xs">{fieldErrors.parentId}</p>
              )}
              {isEdit && initial.childCount > 0 && (
                <p className="text-muted-foreground text-xs">
                  This category has {initial.childCount} sub-categor
                  {initial.childCount === 1 ? 'y' : 'ies'}, so it must stay at the top level.
                </p>
              )}
            </div>

            <div className="flex items-start justify-between gap-4 border-t pt-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="isActive" className="font-medium">
                  Visible on the storefront
                </Label>
                <p className="text-muted-foreground text-xs">
                  Turn off to hide this category without deleting it.
                </p>
              </div>
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex items-start justify-between gap-4 border-t pt-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="isRateVolatile" className="font-medium">
                  Prices change daily
                </Label>
                <p className="text-muted-foreground text-xs">
                  Puts this category’s products on the Today’s Rates screen for the morning
                  update. Use it for cement and sariya.
                </p>
              </div>
              <Switch
                id="isRateVolatile"
                checked={isRateVolatile}
                onCheckedChange={setIsRateVolatile}
              />
            </div>
          </section>

          <CategoryRuleBuilder
            categoryId={initial.id}
            match={autoMatch}
            rules={autoRules}
            tags={tags}
            onMatchChange={setAutoMatch}
            onRulesChange={setAutoRules}
          />

          <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-semibold">Search engine listing</h2>
              <p className="text-muted-foreground text-xs">
                Leave blank to use the category name and description.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoTitle">Page title</Label>
              <Input
                id="seoTitle"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                maxLength={255}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoDescription">Meta description</Label>
              <Input
                id="seoDescription"
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                maxLength={1000}
              />
            </div>
          </section>
        </div>
      </PageContainer>

      {/*
        * Outside `PageContainer` but inside the form, so the dialog is not
        * clipped by the page's own scroll container. One image, so the picker's
        * multi-select answer is taken as its first element.
        */}
      <MediaPickerDialog
        open={picking}
        onOpenChange={setPicking}
        ctx={ctx}
        alreadyPicked={[]}
        onConfirm={(picked) => {
          // The library picker allows a multi-select; a category has one tile,
          // so the first choice wins rather than silently dropping the rest.
          const first = picked[0];
          if (first) setImage(first);
          setPicking(false);
        }}
      />
    </form>
  );
}
