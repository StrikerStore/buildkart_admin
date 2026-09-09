import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth/requireAdmin';
import { BuildKartMark } from '@/components/shell/BuildKartMark';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Already signed in? Skip the form.
  if (await getCurrentAdmin()) redirect('/');

  const { next } = await searchParams;

  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center gap-3">
          <BuildKartMark size="lg" />
          <p className="text-muted-foreground text-center">Sign in to manage your store</p>
        </div>

        <div className="bg-card rounded-lg border p-6 shadow-[var(--shadow-card)]">
          <LoginForm next={next} />
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          BuildKart Admin &middot; Authorised access only
        </p>
      </div>
    </main>
  );
}
