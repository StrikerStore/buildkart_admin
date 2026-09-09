'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BuildKartMark } from './BuildKartMark';
import {
  CHANGELOG_ITEM,
  NAV_ITEMS,
  SETTINGS_ITEM,
  isActivePath,
  isSectionActive,
  type NavBadgeKey,
  type NavItem,
} from './nav-config';

/** Counts the sidebar may render, keyed by `NavItem.badgeKey`. */
export type NavBadges = Partial<Record<NavBadgeKey, number>>;

function NavLink({
  item,
  pathname,
  badges,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  badges?: NavBadges;
  onNavigate?: () => void;
}) {
  const sectionActive = isSectionActive(pathname, item);
  const selfActive = isActivePath(pathname, item.href);
  const Icon = item.icon;
  const count = item.badgeKey ? (badges?.[item.badgeKey] ?? 0) : 0;

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={selfActive ? 'page' : undefined}
        className={cn(
          'relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] font-medium transition-colors',
          'text-[var(--nav-foreground)] hover:bg-[var(--nav-hover)]',
          sectionActive && 'bg-[var(--nav-active)] text-white',
        )}
      >
        {/* The one place the brand yellow appears in the chrome: it marks where you are. */}
        {sectionActive && (
          <span
            className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r bg-[var(--brand)]"
            aria-hidden="true"
          />
        )}
        <Icon className="size-[18px] shrink-0" strokeWidth={2} />
        <span className="truncate">{item.label}</span>

        {/* Only when there is something to say. A badge reading "0" is noise
            where an absent one is an answer. The count is in the accessible
            name too, since the pill on its own is a number without a noun. */}
        {count > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-[var(--brand)] px-1.5 py-px text-xs font-semibold text-black tabular-nums">
            <span className="sr-only">{count} awaiting a reply</span>
            <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
          </span>
        )}
      </Link>

      {/* Sub-navigation reveals only for the section you are in, as Shopify does —
          showing every child at once turns nine items into twenty-two. */}
      {item.children && sectionActive && (
        <ul className="mt-0.5 mb-1 flex flex-col gap-px pl-[34px]">
          {item.children.map((child) => {
            const childActive = isActivePath(pathname, child.href);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={childActive ? 'page' : undefined}
                  className={cn(
                    'block truncate rounded-md px-2.5 py-1.5 transition-colors',
                    childActive
                      ? 'bg-[var(--nav-hover)] font-medium text-white'
                      : 'text-[var(--nav-muted)] hover:bg-[var(--nav-hover)] hover:text-[var(--nav-foreground)]',
                  )}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function AdminSidebar({
  badges,
  onNavigate,
}: {
  badges?: NavBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex h-full w-[232px] shrink-0 flex-col bg-[var(--nav)] text-[var(--nav-foreground)]"
    >
      <div className="flex h-14 items-center border-b border-[var(--nav-border)] px-4">
        <Link href="/" onClick={onNavigate} className="rounded focus-visible:outline-white">
          <BuildKartMark size="sm" tone="light" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-px">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              badges={badges}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </div>

      <div className="border-t border-[var(--nav-border)] px-2 py-2">
        <ul className="flex flex-col gap-px">
          <NavLink item={CHANGELOG_ITEM} pathname={pathname} onNavigate={onNavigate} />
          <NavLink item={SETTINGS_ITEM} pathname={pathname} onNavigate={onNavigate} />
        </ul>
      </div>
    </nav>
  );
}
