import { can } from '@StrikerStore/contract';
import { Toaster } from '@/components/ui/sonner';
import { AdminShell } from '@/components/shell/AdminShell';
import type { NavBadges } from '@/components/shell/AdminSidebar';
import { api } from '@/lib/api/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

/**
 * A Server Component on purpose.
 *
 * It resolves the signed-in admin on the server, then hands `children` to the
 * client shell as a prop. Because the children are produced here rather than
 * imported inside AdminShell, they stay server-rendered — see AdminShell for
 * why that matters.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const badges = await navBadges(admin.role);

  return (
    <>
      <AdminShell admin={admin} badges={badges}>
        {children}
      </AdminShell>
      <Toaster position="top-center" richColors />
    </>
  );
}

/**
 * The counts beside nav labels.
 *
 * This runs on **every** admin page render, which sets two rules. It must be
 * cheap — one indexed count — and it must never be able to take the shell down:
 * a chrome decoration that turns a working orders page into an error boundary
 * is a bad trade, so a failure renders no badge and says so in the log.
 *
 * The role is checked before asking rather than catching the refusal, because a
 * STAFF account that loses the permission later should stop making the query,
 * not start swallowing a ForbiddenError on every page.
 */
async function navBadges(role: Parameters<typeof can>[0]): Promise<NavBadges> {
  let client: Awaited<ReturnType<typeof api>>;
  try {
    client = await api();
  } catch (error) {
    console.error('[nav] could not reach the API for badge counts', error);
    return {};
  }
  const [support, privacy] = await Promise.all([
    can(role, 'support:read')
      ? client.support.awaitingCount.query().catch((error: unknown) => {
          console.error('[nav] could not read the support count', error);
          return undefined;
        })
      : undefined,
    can(role, 'privacy:manage')
      ? client.privacy.openCount.query().catch((error: unknown) => {
          console.error('[nav] could not read the privacy count', error);
          return undefined;
        })
      : undefined,
  ]);
  return {
    ...(support !== undefined ? { support } : {}),
    ...(privacy !== undefined ? { privacy } : {}),
  };
}
