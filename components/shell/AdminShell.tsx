'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { MAIN_SCROLL_ID } from '@/lib/scroll';
import { AdminSidebar, type NavBadges } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';
import type { CurrentAdmin } from '@/lib/auth/requireAdmin';

/**
 * The client shell.
 *
 * `children` arrives as a prop from the Server Component layout, already
 * rendered on the server and streamed *through* this component. That is the
 * whole trick: the shell needs client state (mobile nav, pathname, dropdowns),
 * but nothing it wraps is forced to become a Client Component. Every page under
 * (dashboard) therefore stays a Server Component and queries Prisma directly.
 */
export function AdminShell({
  admin,
  badges,
  children,
}: {
  admin: CurrentAdmin;
  /** Counts rendered beside nav labels, resolved by the server layout. */
  badges?: NavBadges;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="hidden lg:block">
        <AdminSidebar badges={badges} />
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[232px] border-0 bg-[var(--nav)] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AdminSidebar badges={badges} onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar admin={admin} onOpenNav={() => setNavOpen(true)} />
        <main id={MAIN_SCROLL_ID} className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
