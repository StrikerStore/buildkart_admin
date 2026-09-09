import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  PlusIcon,
  PackageIcon,
  UploadIcon,
  DownloadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { productListQuerySchema } from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { ProductFilters } from '@/components/products/ProductFilters';
import { ProductListTable } from '@/components/products/ProductListTable';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { api, serverConfig } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Products' };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const parsed = productListQuerySchema.safeParse({
    q: typeof raw.q === 'string' ? raw.q : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    categoryId: typeof raw.categoryId === 'string' ? raw.categoryId : undefined,
    brandId: typeof raw.brandId === 'string' ? raw.brandId : undefined,
    tagId: typeof raw.tagId === 'string' ? raw.tagId : undefined,
    sort: typeof raw.sort === 'string' ? raw.sort : undefined,
    page: typeof raw.page === 'string' ? raw.page : undefined,
  });
  // A hand-edited URL should show the default list, not an error page.
  const query = parsed.success ? parsed.data : productListQuerySchema.parse({});

  const { products, total, totalPages, filters } =
    await (await api()).catalog.productList.query(query);
  const { categories, brands, tags } = filters;
  const { publicBaseUrl, transformsEnabled } = (await serverConfig()).media;

  const pageParams = (page: number) => {
    const next = new URLSearchParams();
    if (query.q) next.set('q', query.q);
    if (query.status !== 'ALL') next.set('status', query.status);
    if (query.categoryId) next.set('categoryId', query.categoryId);
    if (query.brandId) next.set('brandId', query.brandId);
    if (query.tagId) next.set('tagId', query.tagId);
    if (query.sort !== 'updated') next.set('sort', query.sort);
    if (page > 1) next.set('page', String(page));
    return next.toString() ? `?${next.toString()}` : '';
  };

  const isFiltered = Boolean(
    query.q || query.status !== 'ALL' || query.categoryId || query.brandId || query.tagId,
  );

  /*
   * Export follows the filters the owner is looking at, so "export everything
   * tagged Clearance" needs no separate screen. Free-text search is left out
   * deliberately: the export runs its own query, and silently exporting a
   * different set than the one on screen would be worse than exporting more.
   */
  const exportParams = new URLSearchParams();
  if (query.status !== 'ALL') exportParams.set('status', query.status);
  if (query.categoryId) exportParams.set('categoryId', query.categoryId);
  if (query.tagId) exportParams.set('tagId', query.tagId);
  const exportHref = `/api/products/export${exportParams.toString() ? `?${exportParams}` : ''}`;

  return (
    <PageContainer>
      <PageHeader
        title="Products"
        subtitle={total > 0 ? `${total} product${total === 1 ? '' : 's'}` : undefined}
        actions={
          <>
            {total > 0 && (
              <Button asChild variant="outline">
                <a href={exportHref}>
                  <DownloadIcon className="size-4" />
                  Export
                </a>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/products/import">
                <UploadIcon className="size-4" />
                Import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/products/new">
                <PlusIcon className="size-4" />
                Add product
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {/* useSearchParams needs a Suspense boundary, or the whole route opts
            out of static optimisation and renders entirely on the client. */}
        <Suspense fallback={<div className="h-[92px]" />}>
          <ProductFilters categories={categories} brands={brands} tags={tags} />
        </Suspense>

        {products.length === 0 ? (
          <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
            <PackageIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                {isFiltered ? 'No products match these filters' : 'No products yet'}
              </p>
              <p className="text-muted-foreground max-w-[380px]">
                {isFiltered
                  ? 'Try clearing a filter or searching for something else.'
                  : 'Add your first product, or import an existing catalog from a CSV once that lands.'}
              </p>
            </div>
            {!isFiltered && (
              <Button asChild className="mt-1">
                <Link href="/products/new">
                  <PlusIcon className="size-4" />
                  Add your first product
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <ProductListTable
            products={products}
            allTags={tags}
            publicBaseUrl={publicBaseUrl}
            transformsEnabled={transformsEnabled}
          />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Page {query.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" disabled={query.page <= 1}>
                <Link href={`/products${pageParams(query.page - 1)}`} aria-disabled={query.page <= 1}>
                  <ChevronLeftIcon className="size-4" />
                  Previous
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" disabled={query.page >= totalPages}>
                <Link href={`/products${pageParams(query.page + 1)}`}>
                  Next
                  <ChevronRightIcon className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
