import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  mediaListQuerySchema,
  MEDIA_PAGE_SIZE,
} from '@StrikerStore/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { MediaLibrary } from '@/components/media/MediaLibrary';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { api, serverConfig } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Media' };

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const parsed = mediaListQuerySchema.safeParse({
    q: typeof raw.q === 'string' ? raw.q : undefined,
    sort: typeof raw.sort === 'string' ? raw.sort : undefined,
    order: typeof raw.order === 'string' ? raw.order : undefined,
    page: typeof raw.page === 'string' ? raw.page : undefined,
  });
  // A hand-edited URL should fall back to the default view, not error.
  const query = parsed.success ? parsed.data : mediaListQuerySchema.parse({});

  const [{ media, total, missingAltCount }, config] = await Promise.all([
    (await api()).operations.mediaLibrary.query(query),
    serverConfig(),
  ]);
  const { publicBaseUrl, transformsEnabled } = config.media;

  return (
    <PageContainer>
      <PageHeader
        title="Media"
        subtitle={
          total > 0
            ? `${total} image${total === 1 ? '' : 's'}${missingAltCount > 0 ? ` · ${missingAltCount} without alt text` : ''}`
            : 'Upload once, use on any product, category or banner.'
        }
      />

      {/* useSearchParams needs a Suspense boundary, or the route opts out of
          static optimisation and renders entirely on the client. */}
      <Suspense fallback={<div className="h-[200px]" />}>
        <MediaLibrary
          media={media}
          configured={config.r2Configured}
          publicBaseUrl={publicBaseUrl}
          transformsEnabled={transformsEnabled}
          query={query}
          totalPages={Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE))}
        />
      </Suspense>
    </PageContainer>
  );
}
