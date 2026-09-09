import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogPostForm } from '@/components/content/BlogPostForm';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api, serverConfig } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await (await api()).content.blogPost.query({ id });
  return { title: post?.titleEn ?? 'Post' };
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('content:write');

  const { id } = await params;
  const [post, { media }] = await Promise.all([
    (await api()).content.blogPost.query({ id }),
    serverConfig(),
  ]);

  if (!post) notFound();

  return <BlogPostForm initial={post} ctx={media} />;
}
