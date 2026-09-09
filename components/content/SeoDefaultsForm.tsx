'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  type SeoDefaultsDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { saveSeoDefaults } from '@/app/(dashboard)/seo/actions';

export function SeoDefaultsForm({
  initial,
  storeName,
}: {
  initial: SeoDefaultsDto;
  storeName: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  const set = <K extends keyof SeoDefaultsDto>(key: K, value: SeoDefaultsDto[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveSeoDefaults(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Saved');
      router.refresh();
    });
  }

  const homeTitle = form.homeTitleEn || storeName;
  // What a product page's tab will read, once the template is applied.
  const examplePage = form.titleTemplate
    ? form.titleTemplate.replace('%s', 'UltraTech Cement 50kg')
    : 'UltraTech Cement 50kg';

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">Home page</h2>
          <p className="text-muted-foreground text-xs">
            What a search engine shows for the front page of the shop.
          </p>
        </div>

        <div className="flex flex-col gap-1 rounded-md border p-3">
          <span className="truncate text-xs text-[var(--success-fg)]">buildkart.co</span>
          <span className="truncate text-base text-[#1a0dab]">{homeTitle}</span>
          <span className="text-muted-foreground line-clamp-2 text-xs">
            {form.homeDescriptionEn ||
              'No description yet — search engines will pick their own text.'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="homeTitleEn">Title</Label>
          <Input
            id="homeTitleEn"
            value={form.homeTitleEn}
            onChange={(e) => set('homeTitleEn', e.target.value)}
            placeholder={storeName}
          />
          <Counter value={homeTitle.length} limit={SEO_TITLE_LIMIT} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="homeDescriptionEn">Meta description</Label>
          <Textarea
            id="homeDescriptionEn"
            value={form.homeDescriptionEn}
            onChange={(e) => set('homeDescriptionEn', e.target.value)}
            rows={3}
          />
          <Counter value={form.homeDescriptionEn.length} limit={SEO_DESCRIPTION_LIMIT} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="homeTitleHi">Title (Hindi)</Label>
            <Input
              id="homeTitleHi"
              value={form.homeTitleHi}
              onChange={(e) => set('homeTitleHi', e.target.value)}
              lang="hi"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="homeDescriptionHi">Description (Hindi)</Label>
            <Input
              id="homeDescriptionHi"
              value={form.homeDescriptionHi}
              onChange={(e) => set('homeDescriptionHi', e.target.value)}
              lang="hi"
            />
          </div>
        </div>
      </section>

      <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">Every other page</h2>
          <p className="text-muted-foreground text-xs">
            How a product, category or article title is framed in the browser tab.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titleTemplate">Title template</Label>
          <Input
            id="titleTemplate"
            value={form.titleTemplate}
            onChange={(e) => set('titleTemplate', e.target.value)}
            className="font-mono"
          />
          {errors.titleTemplate ? (
            <span className="text-xs text-[var(--critical-fg)]">{errors.titleTemplate}</span>
          ) : (
            <span className="text-muted-foreground text-xs">
              <code className="font-mono">%s</code> is replaced by the page&apos;s own title —{' '}
              <span className="text-foreground">{examplePage}</span>
            </span>
          )}
        </div>
      </section>

      <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <label className="flex items-start justify-between gap-4">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Let search engines index the site</span>
            <span className="text-muted-foreground text-xs">
              Turn this off while the shop is being set up, so a half-built site
              does not end up in results.
            </span>
          </span>
          <Switch
            checked={form.robotsIndexable}
            onCheckedChange={(v) => set('robotsIndexable', v)}
            className="mt-0.5 shrink-0"
          />
        </label>

        {!form.robotsIndexable && (
          <p className="flex items-start gap-2 rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-fg)]">
            <TriangleAlertIcon className="mt-px size-4 shrink-0" />
            {/* Worth stating plainly: this is the setting people forget to turn
                back on, and the symptom is silence rather than an error. */}
            The whole storefront is hidden from Google while this is off.
          </p>
        )}
      </section>

      <Button type="button" className="self-start" disabled={isSaving} onClick={save}>
        {isSaving ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : (
          <CheckIcon className="size-4" />
        )}
        Save
      </Button>
    </div>
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
