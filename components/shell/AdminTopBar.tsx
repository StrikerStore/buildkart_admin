'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MenuIcon, LogOutIcon, UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logout } from '@/app/(auth)/login/actions';
import type { CurrentAdmin } from '@/lib/auth/requireAdmin';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'A';
}

export function AdminTopBar({
  admin,
  onOpenNav,
}: {
  admin: CurrentAdmin;
  onOpenNav: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onLogout() {
    startTransition(async () => {
      await logout();
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <header className="bg-card flex h-14 shrink-0 items-center gap-3 border-b px-3 lg:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <MenuIcon className="size-5" />
      </Button>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="hover:bg-muted flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors"
          >
            <span className="bg-[var(--nav)] text-[11px] font-semibold text-white flex size-7 items-center justify-center rounded-full">
              {initials(admin.name)}
            </span>
            <span className="hidden max-w-[160px] truncate font-medium sm:block">{admin.name}</span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{admin.name}</span>
              <span className="text-muted-foreground truncate text-xs">{admin.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push('/settings/account')}>
            <UserIcon className="size-4" />
            Account settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onLogout} disabled={isPending}>
            <LogOutIcon className="size-4" />
            {isPending ? 'Logging out…' : 'Log out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
