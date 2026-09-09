import type { Metadata } from 'next';
import { BlogPostForm } from '@/components/content/BlogPostForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { serverConfig } from '@/lib/api/server';

export const metadata: Metadata = { title: 'New post' };

export default async function NewPostPage() {
  await requirePermission('content:write');
  const { media } = await serverConfig();

  return (
    <BlogPostForm
      ctx={media}
      initial={{
        id: null,
        slug: '',
        titleEn: '',
        titleHi: '',
        excerptEn: '',
        excerptHi: '',
        bodyHtmlEn: '',
        bodyHtmlHi: '',
        coverMediaId: null,
        coverImage: null,
        authorName: '',
        seoTitle: '',
        seoDescription: '',
        isPublished: false,
      }}
    />
  );
}
