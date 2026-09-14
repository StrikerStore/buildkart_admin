import type { Metadata } from 'next';
import Link from 'next/link';
import { api, serverConfig } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { ReviewsManager } from '@/components/content/ReviewsManager';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Customer reviews' };

export default async function ReviewsPage() {
  await requireAdmin();
  const client = await api();
  const [rows, sections, { media }] = await Promise.all([
    client.content.customerReviews.query(),
    client.content.homepageSections.query(),
    serverConfig(),
  ]);

  const showing = rows.filter((row) => row.isActive).length;

  /*
   * Reviews only reach the storefront through a CUSTOMER_REVIEWS homepage
   * section. Without one, everything on this screen is invisible to shoppers —
   * and nothing else would say so.
   */
  const band = sections.find((section) => section.type === 'CUSTOMER_REVIEWS');

  return (
    <PageContainer>
      <PageHeader
        title="Customer reviews"
        subtitle={
          rows.length > 0
            ? `${showing} showing of ${rows.length}`
            : 'What customers say, on the home page. Only you can post them.'
        }
      />
      <div className="flex flex-col gap-4">
        {(!band || !band.isActive) && (
          <p className="bg-card rounded-lg border px-3 py-2.5 shadow-[var(--shadow-card)]">
            {band
              ? 'The Customer reviews section is switched off, so none of these show on the website. '
              : 'None of these show on the website until the home page has a Customer reviews section. '}
            <Link href="/homepage" className="font-medium underline underline-offset-2">
              {band ? 'Turn it on in Homepage sections' : 'Add one in Homepage sections'}
            </Link>
          </p>
        )}
        <ReviewsManager rows={rows} ctx={media} />
      </div>
    </PageContainer>
  );
}
