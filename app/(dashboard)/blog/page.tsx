import type { Metadata } from 'next';
import Link from 'next/link';
import { NewspaperIcon, PlusIcon } from 'lucide-react';
import { ADMIN_THUMB, buildMediaUrl, formatStoreDateTimeShort } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api, serverConfig } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Blog' };

export default async function BlogPage() {
  await requirePermission('content:write');

  const [posts, { media: ctx }] = await Promise.all([
    (await api()).content.blogPosts.query(),
    serverConfig(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Blog"
        subtitle={posts.length > 0 ? `${posts.length} posts` : undefined}
        actions={
          <Button asChild>
            <Link href="/blog/new">
              <PlusIcon className="size-4" />
              New post
            </Link>
          </Button>
        }
      />

      {posts.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <NewspaperIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <p className="font-medium">Nothing written yet</p>
          <p className="text-muted-foreground max-w-[420px]">
            Guides on choosing cement, comparing steel grades, or planning a build —
            the things customers ring up to ask.
          </p>
        </div>
      ) : (
        <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          {posts.map((post) => {
            const thumb =
              post.coverImage && ctx.publicBaseUrl
                ? buildMediaUrl(ctx.publicBaseUrl, ctx.transformsEnabled, post.coverImage.r2Key, {
                    w: ADMIN_THUMB,
                  })
                : null;

            return (
              <li key={post.id} className="border-b last:border-b-0">
                <Link
                  href={`/blog/${post.id}`}
                  className="hover:bg-muted/40 flex items-center gap-3 px-3 py-2.5 transition-colors"
                >
                  {thumb ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumb}
                      alt=""
                      className="size-10 shrink-0 rounded border object-cover"
                    />
                  ) : (
                    <span className="bg-muted size-10 shrink-0 rounded border" />
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{post.titleEn}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      /blog/{post.slug}
                      {post.authorName && ` · ${post.authorName}`}
                    </span>
                  </span>

                  <span className="text-muted-foreground shrink-0 text-xs">
                    {post.publishedAt
                      ? formatStoreDateTimeShort(post.publishedAt)
                      : `Edited ${formatStoreDateTimeShort(post.updatedAt)}`}
                  </span>

                  <span
                    className={
                      post.isPublished
                        ? 'shrink-0 rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--success-fg)]'
                        : 'bg-neutral-bg text-neutral-fg shrink-0 rounded-full px-2 py-0.5 text-xs font-medium'
                    }
                  >
                    {post.isPublished ? 'Live' : 'Draft'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
