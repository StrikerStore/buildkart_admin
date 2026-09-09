import type { Metadata } from 'next';
import Link from 'next/link';
import { FileTextIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { PageList } from '@/components/content/PageList';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Pages' };

export default async function PagesPage() {
  await requirePermission('content:write');

  const pages = await (await api()).content.pages.query();
  const draftCount = pages.filter((page) => !page.isPublished).length;

  return (
    <PageContainer>
      <PageHeader
        title="Pages"
        subtitle={
          draftCount > 0
            ? `${pages.length} pages · ${draftCount} still in draft`
            : `${pages.length} pages, all published`
        }
        actions={
          <Button asChild>
            <Link href="/pages/new">
              <PlusIcon className="size-4" />
              New page
            </Link>
          </Button>
        }
      />

      {pages.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <FileTextIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <p className="font-medium">No pages yet</p>
          <p className="text-muted-foreground max-w-[420px]">
            Policies, About us and Contact live here. A payment gateway will ask to
            see most of them before it approves your account.
          </p>
        </div>
      ) : (
        <PageList pages={pages} />
      )}
    </PageContainer>
  );
}
