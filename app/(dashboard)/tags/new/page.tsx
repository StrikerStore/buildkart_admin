import type { Metadata } from 'next';
import { TagForm } from '@/components/tags/TagForm';
import { requirePermission } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'New tag' };

export default async function NewTagPage() {
  await requirePermission('catalog:write');

  return (
    <TagForm
      otherTags={[]}
      initial={{
        id: null,
        nameEn: '',
        nameHi: '',
        slug: '',
        description: '',
        // Internal by default, matching the schema: a new label reaches
        // customers only by an explicit decision.
        scope: 'INTERNAL',
        showAsBadge: false,
        badgeLabelEn: '',
        badgeLabelHi: '',
        badgeTone: 'NEUTRAL',
        position: 0,
        isActive: true,
        productCount: 0,
      }}
    />
  );
}
