import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon, TagsIcon } from 'lucide-react';
import { api } from '@/lib/api/server';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { TagBadge } from '@/components/tags/TagBadge';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Tags' };

export default async function TagsPage() {
  await requireAdmin();
  const tags = await (await api()).catalog.tagList.query();

  const publicTags = tags.filter((t) => t.scope === 'PUBLIC');
  const internalTags = tags.filter((t) => t.scope === 'INTERNAL');

  return (
    <PageContainer>
      <PageHeader
        title="Tags"
        subtitle={
          tags.length > 0
            ? `${publicTags.length} public, ${internalTags.length} internal`
            : 'Flexible labels for grouping, filtering and merchandising.'
        }
        actions={
          <Button asChild>
            <Link href="/tags/new">
              <PlusIcon className="size-4" />
              Add tag
            </Link>
          </Button>
        }
      />

      {tags.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <TagsIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <div className="flex flex-col gap-1">
            <p className="font-medium">No tags yet</p>
            <p className="text-muted-foreground max-w-[440px]">
              Tags group products across categories without changing the category tree. Use public
              ones for merchandising — Bestseller, Clearance — and internal ones for workflow, like
              Needs Review.
            </p>
          </div>
          <Button asChild className="mt-1">
            <Link href="/tags/new">
              <PlusIcon className="size-4" />
              Add your first tag
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {[
            { label: 'Public', hint: 'May appear on the storefront.', rows: publicTags },
            { label: 'Internal', hint: 'Admin only. Never shown to customers.', rows: internalTags },
          ]
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <section key={group.label} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-semibold">{group.label}</h2>
                  <span className="text-muted-foreground text-xs">{group.hint}</span>
                </div>

                <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
                  {group.rows.map((tag) => (
                    <li key={tag.id} className="border-b last:border-b-0">
                      <Link
                        href={`/tags/${tag.id}`}
                        className={cn(
                          'hover:bg-muted/40 flex items-center gap-3 px-3 py-2.5 transition-colors',
                          !tag.isActive && 'opacity-55',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium">{tag.nameEn}</span>
                            {tag.showAsBadge && (
                              <TagBadge
                                label={tag.badgeLabelEn ?? tag.nameEn}
                                tone={tag.badgeTone}
                              />
                            )}
                            {!tag.isActive && (
                              <span className="text-muted-foreground text-xs">Retired</span>
                            )}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {tag.description ?? tag.slug}
                          </span>
                        </span>

                        {tag.categoryRuleCount > 0 && (
                          <span className="hidden shrink-0 rounded-full bg-[var(--info-bg)] px-2 py-0.5 text-xs font-medium text-[var(--info-fg)] md:block">
                            Used by {tag.categoryRuleCount} categor
                            {tag.categoryRuleCount === 1 ? 'y' : 'ies'}
                          </span>
                        )}

                        <span className="text-muted-foreground tabular w-[90px] shrink-0 text-right text-xs">
                          {tag.productCount} product{tag.productCount === 1 ? '' : 's'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </PageContainer>
  );
}
