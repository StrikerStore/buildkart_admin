import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { CannedReplyManager } from '@/components/support/CannedReplyManager';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Saved replies' };

/**
 * The answers the owner gives over and over.
 *
 * Its own page rather than a settings child: these are written *while*
 * answering — the moment you notice you have typed the same sentence three
 * times — so it sits one click from the inbox, not four from Settings.
 */
export default async function CannedRepliesPage() {
  await requirePermission('support:read');
  const replies = await (await api()).support.cannedReplies.query();

  return (
    <PageContainer narrow>
      <PageHeader
        title="Saved replies"
        backHref="/support"
        backLabel="Support"
        subtitle="Answers you send often. Pick one while replying and edit it before it goes out."
      />
      <CannedReplyManager replies={replies} />
    </PageContainer>
  );
}
