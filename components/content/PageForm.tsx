'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  PAGE_KINDS,
  PAGE_KIND_LABELS,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  slugify,
  type MediaUrlContext,
  type PageFormDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { RichTextEditor } from '@/components/form/RichTextEditor';
import { deletePage, savePage } from '@/app/(dashboard)/pages/actions';

/**
 * One form for create and edit, as everywhere else — `initial.id === null` is
 * the only difference, and it decides the heading, the slug behaviour and
 * whether Delete is offered.
 */
export function PageForm({ initial, ctx }: { initial: PageFormDto; ctx: MediaUrlContext }) {
  const router = useRouter();
  const isEdit = initial.id !== null;

  const [form, setForm] = useState(initial);
  /*
   * A new page's slug follows the title until somebody edits it. An existing
   * page's never does: the URL is in a footer, in a payment gateway's records
   * and possibly in Google's index, and it must not move because a typo in the
   * title was corrected.
   */
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const set = <K extends keyof PageFormDto>(key: K, value: PageFormDto[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function save() {
    setErrors({});
    setFormError(null);
    startSaving(async () => {
      const result = await savePage({ ...form, id: form.id ?? undefined });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success(isEdit ? 'Page saved' : 'Page created');
      if (!isEdit) router.push(`/pages/${result.data.id}`);
      else router.refresh();
    });
  }

  function remove() {
    startDeleting(async () => {
      const result = await deletePage({ id: form.id });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not delete that page.');
        return;
      }
      toast.success('Page deleted');
      router.push('/pages');
    });
  }

  const slugPreview = form.slug || slugify(form.titleEn) || 'page-url';

  return (
    <PageContainer>
      <PageHeader
        title={isEdit ? form.titleEn || 'Page' : 'New page'}
        backHref="/pages"
        backLabel="Pages"
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
              <Label htmlFor="titleHi">Title (Hindi)</Label>
              <Input
                id="titleHi"
                value={form.titleHi}
                onChange={(e) => set('titleHi', e.target.value)}
                lang="hi"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">URL</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground shrink-0 text-xs">/pages/</span>
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
              {errors.slug ? (
                <span className="text-xs text-[var(--critical-fg)]">{errors.slug}</span>
              ) : (
                isEdit && (
                  <span className="text-muted-foreground text-xs">
                    Changing this breaks any link already pointing here.
                  </span>
                )
              )}
            </div>
          </Card>

          <Card title="Content">
            <RichTextEditor
              value={form.bodyHtmlEn}
              onChange={(html) => set('bodyHtmlEn', html)}
              ctx={ctx}
              placeholder="Write the page…"
            />
          </Card>

          <Card title="Content (Hindi)" subtitle="Optional. Falls back to English when blank.">
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
            path={`/pages/${slugPreview}`}
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
                  {form.isPublished
                    ? 'Anyone can read this page.'
                    : 'Hidden from the storefront.'}
                </span>
              </span>
              <Switch
                checked={form.isPublished}
                onCheckedChange={(v) => set('isPublished', v)}
                className="mt-0.5 shrink-0"
              />
            </label>
          </Card>

          <Card title="Kind" subtitle="Policies are grouped together in the footer.">
            <Select value={form.kind} onValueChange={(v) => set('kind', v as PageFormDto['kind'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {PAGE_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        </div>
      </div>

      {formError && (
        <p className="mt-4 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
          {formError}
        </p>
      )}
    </PageContainer>
  );
}

export function Card({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      {title && (
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * The search-engine block, shared by pages and posts.
 *
 * The counters are a warning, not a limit: a longer title is legal and simply
 * gets truncated in results, so refusing to save one would be inventing a rule
 * search engines do not have.
 */
export function SeoFields({
  title,
  description,
  fallbackTitle,
  path,
  onTitle,
  onDescription,
}: {
  title: string;
  description: string;
  fallbackTitle: string;
  path: string;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
}) {
  const shownTitle = title || fallbackTitle || 'Untitled';

  return (
    <Card title="Search engine listing" subtitle="Leave blank to use the title above.">
      <div className="flex flex-col gap-1 rounded-md border p-3">
        <span className="truncate text-xs text-[var(--success-fg)]">buildkart.co{path}</span>
        <span className="truncate text-base text-[#1a0dab]">{shownTitle}</span>
        <span className="text-muted-foreground line-clamp-2 text-xs">
          {description || 'No description yet — search engines will pick their own text.'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seoTitle">Page title</Label>
        <Input id="seoTitle" value={title} onChange={(e) => onTitle(e.target.value)} maxLength={255} />
        <Counter value={shownTitle.length} limit={SEO_TITLE_LIMIT} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seoDescription">Meta description</Label>
        <Textarea
          id="seoDescription"
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          rows={3}
          maxLength={320}
        />
        <Counter value={description.length} limit={SEO_DESCRIPTION_LIMIT} />
      </div>
    </Card>
  );
}

function Counter({ value, limit }: { value: number; limit: number }) {
  const over = value > limit;
  return (
    <span className={`text-xs ${over ? 'text-[var(--warning-fg)]' : 'text-muted-foreground'}`}>
      {value} / {limit}
      {over && ' — will be cut short in search results'}
    </span>
  );
}
