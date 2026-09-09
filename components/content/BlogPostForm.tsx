'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, ImageIcon, LoaderCircleIcon, Trash2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  ADMIN_THUMB_2X,
  buildMediaUrl,
  slugify,
  type BlogPostFormDto,
  type MediaUrlContext,
} from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { RichTextEditor } from '@/components/form/RichTextEditor';
import { MediaPickerDialog, type PickedImage } from '@/components/media/ProductImages';
import { Card, SeoFields } from './PageForm';
import { deleteBlogPost, saveBlogPost } from '@/app/(dashboard)/blog/actions';

export function BlogPostForm({
  initial,
  ctx,
}: {
  initial: BlogPostFormDto;
  ctx: MediaUrlContext;
}) {
  const router = useRouter();
  const isEdit = initial.id !== null;

  const [form, setForm] = useState(initial);
  const [cover, setCover] = useState<PickedImage | null>(initial.coverImage);
  // A published post's URL is out in the world; only a new one follows its title.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const set = <K extends keyof BlogPostFormDto>(key: K, value: BlogPostFormDto[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function save() {
    setErrors({});
    setFormError(null);
    startSaving(async () => {
      const result = await saveBlogPost({
        ...form,
        id: form.id ?? undefined,
        coverMediaId: cover?.id ?? undefined,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success(isEdit ? 'Post saved' : 'Post created');
      if (!isEdit) router.push(`/blog/${result.data.id}`);
      else router.refresh();
    });
  }

  function remove() {
    startDeleting(async () => {
      const result = await deleteBlogPost({ id: form.id });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not delete that post.');
        return;
      }
      toast.success('Post deleted');
      router.push('/blog');
    });
  }

  const slugPreview = form.slug || slugify(form.titleEn) || 'post-url';
  const coverUrl =
    cover && ctx.publicBaseUrl
      ? buildMediaUrl(ctx.publicBaseUrl, ctx.transformsEnabled, cover.r2Key, { w: ADMIN_THUMB_2X })
      : null;

  return (
    <PageContainer>
      <PageHeader
        title={isEdit ? form.titleEn || 'Post' : 'New post'}
        backHref="/blog"
        backLabel="Blog"
        badge={
          <span
            className={
              form.isPublished
                ? 'rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--success-fg)]'
                : 'bg-neutral-bg text-neutral-fg rounded-full px-2 py-0.5 text-xs font-medium'
            }
          >
            {form.isPublished ? 'Published' : 'Draft'}
          </span>
        }
        actions={
          <>
            {isEdit && (
              <Button type="button" variant="ghost" disabled={isDeleting} onClick={remove}>
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            )}
            <Button type="button" disabled={isSaving} onClick={save}>
              {isSaving ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <CheckIcon className="size-4" />
              )}
              Save
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titleEn">Title</Label>
              <Input
                id="titleEn"
                value={form.titleEn}
                onChange={(e) => {
                  set('titleEn', e.target.value);
                  if (!slugTouched) set('slug', slugify(e.target.value));
                }}
              />
              {errors.titleEn && (
                <span className="text-xs text-[var(--critical-fg)]">{errors.titleEn}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">URL</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground shrink-0 text-xs">/blog/</span>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set('slug', e.target.value);
                  }}
                  placeholder={slugPreview}
                  className="font-mono"
                />
              </div>
              {errors.slug && <span className="text-xs text-[var(--critical-fg)]">{errors.slug}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="excerptEn">Excerpt</Label>
              <Textarea
                id="excerptEn"
                value={form.excerptEn}
                onChange={(e) => set('excerptEn', e.target.value)}
                rows={2}
                maxLength={500}
              />
              <span className="text-muted-foreground text-xs">
                {/* Filled from the body on save when left blank — an empty
                    excerpt on a listing card reads as a broken post. */}
                Shown on listing cards. Leave blank to take the opening of the post.
              </span>
            </div>
          </Card>

          <Card title="Post">
            <RichTextEditor
              value={form.bodyHtmlEn}
              onChange={(html) => set('bodyHtmlEn', html)}
              ctx={ctx}
              placeholder="Write the post…"
            />
          </Card>

          <Card title="Post (Hindi)" subtitle="Optional. Falls back to English when blank.">
            <RichTextEditor
              value={form.bodyHtmlHi}
              onChange={(html) => set('bodyHtmlHi', html)}
              ctx={ctx}
              lang="hi"
            />
          </Card>

          <SeoFields
            title={form.seoTitle}
            description={form.seoDescription}
            fallbackTitle={form.titleEn}
            path={`/blog/${slugPreview}`}
            onTitle={(v) => set('seoTitle', v)}
            onDescription={(v) => set('seoDescription', v)}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <label className="flex items-start justify-between gap-4">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Published</span>
                <span className="text-muted-foreground text-xs">
                  {form.isPublished ? 'Visible on the blog.' : 'Hidden from the storefront.'}
                </span>
              </span>
              <Switch
                checked={form.isPublished}
                onCheckedChange={(v) => set('isPublished', v)}
                className="mt-0.5 shrink-0"
              />
            </label>
          </Card>

          <Card title="Cover image">
            {coverUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt={cover?.altTextEn ?? ''}
                  className="aspect-video w-full rounded-md border object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => setCover(null)}
                >
                  <XIcon className="size-4" />
                  Remove
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
                <ImageIcon className="size-4" />
                Choose an image
              </Button>
            )}
            {errors.coverMediaId && (
              <span className="text-xs text-[var(--critical-fg)]">{errors.coverMediaId}</span>
            )}
          </Card>

          <Card title="Author">
            <Input
              value={form.authorName}
              onChange={(e) => set('authorName', e.target.value)}
              placeholder="Optional"
            />
          </Card>
        </div>
      </div>

      {formError && (
        <p className="mt-4 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
          {formError}
        </p>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        ctx={ctx}
        alreadyPicked={cover ? [cover] : []}
        onConfirm={(picked) => {
          setCover(picked[0] ?? null);
          setPickerOpen(false);
        }}
      />
    </PageContainer>
  );
}
