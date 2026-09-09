import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon, FolderTreeIcon } from 'lucide-react';
import { api } from '@/lib/api/server';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { CategoryList } from '@/components/categories/CategoryList';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Categories' };

/**
 * A Server Component: it queries Prisma directly and hands plain DTOs to the
 * client list, which owns only the drag interaction.
 */
export default async function CategoriesPage() {
  await requireAdmin();
  const categories = await (await api()).catalog.categoryList.query();
  const rootCount = categories.filter((c) => c.parentId === null).length;

  return (
    <PageContainer>
      <PageHeader
        title="Categories"
        subtitle={
          categories.length > 0
            ? `${rootCount} top-level, ${categories.length - rootCount} sub-categor${categories.length - rootCount === 1 ? 'y' : 'ies'}. Drag to reorder.`
            : 'The category tree customers browse.'
        }
        actions={
          <Button asChild>
            <Link href="/categories/new">
              <PlusIcon className="size-4" />
              Add category
            </Link>
          </Button>
        }
      />

      {categories.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <FolderTreeIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <div className="flex flex-col gap-1">
            <p className="font-medium">No categories yet</p>
            <p className="text-muted-foreground max-w-[380px]">
              Categories are the big tiles customers tap first — Cement, Sariya, Plywood. Start
              with the ones you sell most.
            </p>
          </div>
          <Button asChild className="mt-1">
            <Link href="/categories/new">
              <PlusIcon className="size-4" />
              Add your first category
            </Link>
          </Button>
        </div>
      ) : (
        <CategoryList categories={categories} />
      )}
    </PageContainer>
  );
}
