import type { Metadata } from 'next';
import Link from 'next/link';
import { MENU_HANDLES, MENU_LABELS, type MenuHandle } from '@StrikerStore/contract';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { MenuBuilder } from '@/components/content/MenuBuilder';
import { requirePermission } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Menus' };

const MENU_HINTS: Record<MenuHandle, string> = {
  header:
    'The row across the top of the site on a computer. Sub-links drop down under their link on hover.',
  footer:
    'The block at the bottom of every page. A group becomes one titled column — "Policy" with the policies under it — and links left on their own share an untitled column beside them. Contact details are not here: they come from Settings.',
  mobile:
    'The side panel behind the ☰ button on a phone. Sub-links open under their link when it is tapped.',
};

/**
 * One screen, one menu at a time, chosen by a tab in the URL.
 *
 * A tab rather than three screens because the menus are edited against each
 * other — what goes in the header versus the footer is one decision.
 */
export default async function MenusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('content:write');

  const raw = await searchParams;
  const requested = typeof raw.menu === 'string' ? raw.menu : '';
  const handle: MenuHandle = (MENU_HANDLES as readonly string[]).includes(requested)
    ? (requested as MenuHandle)
    : 'header';

  const client = await api();
  const [menu, targets] = await Promise.all([
    client.content.menu.query({ handle }),
    client.content.menuTargets.query(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Menus"
        subtitle="The links in the header, the footer and the mobile menu."
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1 overflow-x-auto border-b">
          {MENU_HANDLES.map((option) => (
            <Link
              key={option}
              href={`/menus?menu=${option}`}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-3 py-2 font-medium transition-colors',
                option === handle
                  ? 'border-[var(--nav)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {MENU_LABELS[option]}
            </Link>
          ))}
        </div>

        {/*
          * What the shape of this menu turns into, said once per tab.
          *
          * The three menus are edited in the same builder but are not drawn the
          * same way, and "Add a group" means nothing until you know the footer
          * renders a group as a column. Stated here rather than in the builder
          * so it does not repeat above every card.
          */}
        <p className="text-muted-foreground text-sm">{MENU_HINTS[handle]}</p>

        <MenuBuilder key={handle} menu={menu} targets={targets} />
      </div>
    </PageContainer>
  );
}
