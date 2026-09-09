'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircleIcon, LoaderCircleIcon, Trash2Icon, MergeIcon } from 'lucide-react';
import { toast } from 'sonner';
import { scrollMainToTop } from '@/lib/scroll';
import {
  slugify,
  TAG_TONES,
  TAG_TONE_LABELS,
  type TagScope,
  type TagTone,
} from '@buildkart/contract';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { TagBadge } from './TagBadge';
import { createTag, updateTag, deleteTag, mergeTags } from '@/app/(dashboard)/tags/actions';

export type TagFormInitial = {
  id: string | null;
  nameEn: string;
  nameHi: string;
  slug: string;
  description: string;
  scope: TagScope;
  showAsBadge: boolean;
  badgeLabelEn: string;
  badgeLabelHi: string;
  badgeTone: TagTone;
  position: number;
  isActive: boolean;
  productCount: number;
};

export function TagForm({
  initial,
  otherTags,
}: {
  initial: TagFormInitial;
  otherTags: Array<{ id: string; nameEn: string; productCount: number }>;
}) {
  const router = useRouter();
  const isEdit = initial.id !== null;

  const [nameEn, setNameEn] = useState(initial.nameEn);
  const [nameHi, setNameHi] = useState(initial.nameHi);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(initial.description);
  const [scope, setScope] = useState<TagScope>(initial.scope);
  const [showAsBadge, setShowAsBadge] = useState(initial.showAsBadge);
  const [badgeLabelEn, setBadgeLabelEn] = useState(initial.badgeLabelEn);
  const [badgeLabelHi, setBadgeLabelHi] = useState(initial.badgeLabelHi);
  const [badgeTone, setBadgeTone] = useState<TagTone>(initial.badgeTone);
  const [isActive, setIsActive] = useState(initial.isActive);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [isMerging, startMerging] = useTransition();

  function onNameChange(value: string) {
    setNameEn(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function onScopeChange(next: TagScope) {
    setScope(next);
    // A badge is customer-facing by definition, so it cannot survive a demotion
    // to internal. Clearing it here matches what the server would do anyway.
    if (next === 'INTERNAL') setShowAsBadge(false);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const payload = {
      nameEn,
      nameHi,
      slug,
      description,
      scope,
      showAsBadge,
      badgeLabelEn,
      badgeLabelHi,
      badgeTone,
      position: initial.position,
      isActive,
    };

    startSaving(async () => {
      const result = initial.id ? await updateTag(initial.id, payload) : await createTag(payload);
      if (!result.ok) {
        setFormError(result.formErrors[0] ?? null);
        setFieldErrors(result.fieldErrors);
        if (!result.formErrors[0] && Object.keys(result.fieldErrors).length === 0) {
          setFormError('Could not save this tag.');
        }
        scrollMainToTop();
        return;
      }
      toast.success(isEdit ? 'Tag saved' : 'Tag created');
      router.push('/tags');
      router.refresh();
    });
  }

  function onDelete() {
    if (!initial.id) return;
    const warning =
      initial.productCount > 0
        ? `Delete “${initial.nameEn}”? It will be removed from ${initial.productCount} product${initial.productCount === 1 ? '' : 's'}.`
        : `Delete “${initial.nameEn}”?`;
    if (!window.confirm(warning)) return;

    startDeleting(async () => {
      const result = await deleteTag(initial.id!);
      if (!result.ok) {
        setFormError(result.formErrors[0] ?? 'Could not delete this tag.');
        scrollMainToTop();
        return;
      }
      toast.success('Tag deleted');
      router.push('/tags');
      router.refresh();
    });
  }

  function onMerge() {
    if (!initial.id || !mergeTargetId) return;
    startMerging(async () => {
      const result = await mergeTags(initial.id!, mergeTargetId);
      if (!result.ok) {
        setFormError(result.formErrors[0] ?? 'Could not merge these tags.');
        setMergeOpen(false);
        scrollMainToTop();
        return;
      }
      toast.success(`Merged — ${result.data.moved} product${result.data.moved === 1 ? '' : 's'} moved`);
      router.push('/tags');
      router.refresh();
    });
  }

  const busy = isSaving || isDeleting || isMerging;
  const previewLabel = (showAsBadge && badgeLabelEn.trim()) || nameEn || 'Tag';

  return (
    <form onSubmit={onSubmit}>
      <PageContainer narrow>
        <PageHeader
          title={isEdit ? initial.nameEn || 'Edit tag' : 'New tag'}
          backHref="/tags"
          backLabel="Tags"
          actions={
            <>
              {isEdit && otherTags.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMergeOpen(true)}
                  disabled={busy}
                >
                  <MergeIcon className="size-4" />
                  Merge
                </Button>
              )}
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nameEn">Name</Label>
              <Input
                id="nameEn"
                value={nameEn}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Bestseller"
                maxLength={191}
                aria-invalid={Boolean(fieldErrors.nameEn)}
              />
              {fieldErrors.nameEn && (
                <p className="text-[var(--critical-fg)] text-xs">{fieldErrors.nameEn}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nameHi">Name (Hindi)</Label>
              <Input
                id="nameHi"
                value={nameHi}
                onChange={(e) => setNameHi(e.target.value)}
                lang="hi"
                maxLength={191}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">What it is for</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Top sellers, refreshed monthly"
                maxLength={500}
              />
              <p className="text-muted-foreground text-xs">
                A note for whoever picks this tag later. Never shown to customers.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                className="font-mono"
                maxLength={191}
                aria-invalid={Boolean(fieldErrors.slug)}
              />
              {fieldErrors.slug ? (
                <p className="text-[var(--critical-fg)] text-xs">{fieldErrors.slug}</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Used in CSV import and export, and in storefront URLs for public tags.
                </p>
              )}
            </div>
          </section>

          <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
            <h2 className="font-semibold">Visibility</h2>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scope">Who can see this tag</Label>
              <Select value={scope} onValueChange={(v) => onScopeChange(v as TagScope)}>
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERNAL">Internal — admin only</SelectItem>
                  <SelectItem value="PUBLIC">Public — may appear on the storefront</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {scope === 'INTERNAL'
                  ? 'For workflow and filtering: Needs Review, Priority, Pending Update. Customers never see it.'
                  : 'For merchandising: Bestseller, New, Clearance. Can be shown as a badge and used to fill a category.'}
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 border-t pt-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="isActive" className="font-medium">
                  Active
                </Label>
                <p className="text-muted-foreground text-xs">
                  Turn off to retire a tag without removing it from products.
                </p>
              </div>
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </section>

          <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <h2 className="font-semibold">Storefront badge</h2>
                <p className="text-muted-foreground text-xs">
                  {scope === 'PUBLIC'
                    ? 'Shows on the product card, e.g. a “Bestseller” ribbon.'
                    : 'Only a public tag can carry a badge.'}
                </p>
              </div>
              <Switch
                id="showAsBadge"
                checked={showAsBadge}
                disabled={scope !== 'PUBLIC'}
                onCheckedChange={setShowAsBadge}
              />
            </div>

            {showAsBadge && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="badgeEn">Badge text</Label>
                    <Input
                      id="badgeEn"
                      value={badgeLabelEn}
                      onChange={(e) => setBadgeLabelEn(e.target.value)}
                      placeholder={nameEn || 'Bestseller'}
                      maxLength={64}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="badgeHi">Badge text (Hindi)</Label>
                    <Input
                      id="badgeHi"
                      value={badgeLabelHi}
                      onChange={(e) => setBadgeLabelHi(e.target.value)}
                      lang="hi"
                      maxLength={64}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tone">Colour</Label>
                  <Select value={badgeTone} onValueChange={(v) => setBadgeTone(v as TagTone)}>
                    <SelectTrigger id="tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAG_TONES.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {TAG_TONE_LABELS[tone]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 border-t pt-4">
                  <span className="text-muted-foreground text-xs">Preview</span>
                  <TagBadge label={previewLabel} tone={badgeTone} />
                </div>
              </>
            )}
          </section>

          {isEdit && (
            <p className="text-muted-foreground px-1 text-xs">
              Used on {initial.productCount} product{initial.productCount === 1 ? '' : 's'}.
            </p>
          )}
        </div>
      </PageContainer>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Merge “{initial.nameEn}” into another tag</DialogTitle>
            <DialogDescription>
              Every product carrying this tag gets the other one instead, and this tag is deleted.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mergeTarget">Keep this tag</Label>
            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
              <SelectTrigger id="mergeTarget">
                <SelectValue placeholder="Choose a tag" />
              </SelectTrigger>
              <SelectContent>
                {otherTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.nameEn} ({tag.productCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMergeOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onMerge} disabled={!mergeTargetId || isMerging}>
              {isMerging && <LoaderCircleIcon className="size-4 animate-spin" />}
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
