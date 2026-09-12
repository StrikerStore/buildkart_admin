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
  /*
   * Already signed in? Skip the form.
   *
   * This stays on the page rather than moving up to the layout for two reasons:
   * a layout runs for every route in the group, so it would one day bounce a
   * signed-in admin away from a password reset they asked for — and Next hands
   * `searchParams` to pages only, so the `next` read below could not move there
   * anyway.
   */
  if (await getCurrentAdmin()) redirect('/');

  const { next } = await searchParams;

  return (
    <div className="w-full max-w-[400px]">
      {/* The mark rides in the brand panel from `lg` up. Below that the panel is
          gone, so the form column carries it instead. */}
      <BuildKartMark size="lg" className="mb-6 lg:hidden" />

      <h1 className="text-xl leading-tight font-semibold tracking-tight">Log in</h1>
      <p className="text-muted-foreground mt-1">Sign in to manage your store.</p>

      <div className="bg-card mt-5 rounded-lg border p-6 shadow-[var(--shadow-card)]">
        <LoginForm next={next} />
      </div>

      <p className="text-muted-foreground mt-6 text-xs">
        BuildKart Admin &middot; Authorised access only
      </p>
    </div>
  );
}
