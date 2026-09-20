import {
  HouseIcon,
  ShoppingBagIcon,
  PackageIcon,
  UsersIcon,
  TagIcon,
  ImageIcon,
  TruckIcon,
  ChartNoAxesColumnIcon,
  CreditCardIcon,
  MessageSquareIcon,
  LifeBuoyIcon,
  HistoryIcon,
  SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { can, type AdminRole, type Permission } from '@StrikerStore/contract';

export type NavChild = {
  label: string;
  href: string;
};

/**
 * Names a count the sidebar renders beside the label.
 *
 * A key rather than the number itself, because this module is static
 * configuration and the number is a query. The layout fetches it and hands the
 * sidebar a `{ support: 3 }` map; a key with no entry, or a zero, renders
 * nothing — a badge showing "0" is a worse answer than no badge.
 */
export type NavBadgeKey = 'support';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Rendered as a nested list once the section is active, mirroring Shopify's nav. */
  children?: NavChild[];
  badgeKey?: NavBadgeKey;
  /**
   * Hides the item from roles that lack it.
   *
   * Presentation only — the page itself calls `requirePermission`, and that is
   * the boundary. This is about not offering somebody a door they cannot open:
   * a link that 403s is worse than no link.
   */
  permission?: Permission;
};

/** The items a role should be shown. See `NavItem.permission`. */
export function navItemsFor(role: AdminRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
}

/**
 * Ordered by how often the owner touches each area on a normal day: orders and
 * the daily rate update come before configuration, and Settings sits alone at
 * the bottom because it is visited rarely and never urgently.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: HouseIcon },
  { label: 'Orders', href: '/orders', icon: ShoppingBagIcon },
  {
    label: 'Products',
    href: '/products',
    icon: PackageIcon,
    children: [
      { label: 'All products', href: '/products' },
      { label: "Today's Rates", href: '/rates' },
      { label: 'Bulk rates', href: '/bulk-pricing' },
      { label: 'Inventory', href: '/inventory' },
      { label: 'Categories', href: '/categories' },
      { label: 'Tags', href: '/tags' },
      { label: 'Custom fields', href: '/metafields' },
    ],
  },
  { label: 'Media', href: '/media', icon: ImageIcon },
  { label: 'Customers', href: '/customers', icon: UsersIcon },
  /*
   * Beside Customers, and above Discounts, because it is the only item in this
   * list where somebody is waiting. Distinct from Messages below, which is
   * outbound templates — this is the conversation itself.
   */
  /*
   * No children, unlike Products and Website. Saved replies is reached from the
   * inbox instead: a child whose href is a prefix sibling of its parent's would
   * light both rows up at once, and the only other page here is one the owner
   * visits from the screen where they noticed they were retyping something.
   */
  { label: 'Support', href: '/support', icon: LifeBuoyIcon, badgeKey: 'support' },
  { label: 'Discounts', href: '/discounts', icon: TagIcon },
  {
    label: 'Delivery',
    href: '/delivery/pincodes',
    icon: TruckIcon,
    permission: 'delivery:write',
    children: [
      { label: 'Serviceable pincodes', href: '/delivery/pincodes' },
      { label: 'Warehouses', href: '/delivery/warehouses' },
      { label: 'Delivery charges', href: '/delivery/charges' },
      { label: 'Area requests', href: '/delivery/requests' },
    ],
  },
  /*
   * Its own item rather than a Settings child: checkout is where the shop is
   * shaped, not where it is configured once and forgotten, and it sits beside
   * Orders because that is what it produces.
   */
  { label: 'Checkout', href: '/checkout', icon: CreditCardIcon },
  { label: 'Messages', href: '/notifications', icon: MessageSquareIcon },
  {
    label: 'Website',
    href: '/homepage',
    icon: ChartNoAxesColumnIcon,
    children: [
      { label: 'Homepage sections', href: '/homepage' },
      { label: 'Announcement bar', href: '/announcements' },
      { label: 'Banners', href: '/banners' },
      { label: 'Customer reviews', href: '/reviews' },
      { label: 'Pages', href: '/pages' },
      { label: 'Menus', href: '/menus' },
      { label: 'Blog', href: '/blog' },
      { label: 'Search engine', href: '/seo' },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  label: 'Settings',
  href: '/settings',
  icon: SettingsIcon,
};

/**
 * Sits beside Settings at the bottom rather than in the list above: it is not a
 * place the owner works, it is where they go to find out what happened. Its own
 * item rather than a Settings child because it is read from every part of the
 * admin, not just while configuring one.
 */
export const CHANGELOG_ITEM: NavItem = {
  label: 'Change log',
  href: '/changelog',
  icon: HistoryIcon,
};

/**
 * `/` must match exactly or it would light up on every page; everything else
 * matches by prefix so a detail route keeps its section highlighted.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** True when the item itself or any of its children is active. */
export function isSectionActive(pathname: string, item: NavItem): boolean {
  if (isActivePath(pathname, item.href)) return true;
  return (item.children ?? []).some((child) => isActivePath(pathname, child.href));
}
