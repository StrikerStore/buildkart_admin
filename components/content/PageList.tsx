'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GripVerticalIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PAGE_KIND_LABELS, type PageListItemDto } from '@StrikerStore/contract';
import { Switch } from '@/components/ui/switch';
import { reorderPages, setPagePublished } from '@/app/(dashboard)/pages/actions';
import { cn } from '@/lib/utils';

/**
 * The page list, reorderable by drag.
 *
 * Order matters here because it is the order they appear in the storefront's
 * footer — which is the only place most of these pages are ever linked from.
 */
export function PageList({ pages }: { pages: PageListItemDto[] }) {
  const router = useRouter();
  const [items, setItems] = useState(pages);
  const [, startSaving] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from === -1 || to === -1) return;

    // Moved locally first so the row lands under the cursor immediately; the
    // server call reconciles, and a failure puts it back.
    const next = arrayMove(items, from, to);
    setItems(next);

    startSaving(async () => {
      const result = await reorderPages({ ids: next.map((item) => item.id) });
      if (!result.ok) {
        setItems(items);
        toast.error(result.formErrors[0] ?? 'Could not save the new order.');
      }
    });
  }

  function togglePublished(page: PageListItemDto, isActive: boolean) {
    setItems((current) =>
      current.map((item) => (item.id === page.id ? { ...item, isPublished: isActive } : item)),
    );
    startSaving(async () => {
      const result = await setPagePublished({ id: page.id, isActive });
      if (!result.ok) {
        setItems(pages);
        toast.error(result.formErrors[0] ?? 'Could not change that.');
        return;
      }
      toast.success(isActive ? `${page.titleEn} is live` : `${page.titleEn} is hidden`);
      router.refresh();
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          {items.map((page) => (
            <Row key={page.id} page={page} onTogglePublished={togglePublished} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({
  page,
  onTogglePublished,
}: {
  page: PageListItemDto;
  onTogglePublished: (page: PageListItemDto, isActive: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 border-b px-2 py-2 last:border-b-0',
        isDragging && 'bg-muted/60 relative z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none p-1"
        aria-label={`Reorder ${page.titleEn}`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <Link href={`/pages/${page.id}`} className="hover:bg-muted/40 min-w-0 flex-1 rounded px-1 py-1">
        <span className="block truncate font-medium">{page.titleEn}</span>
        <span className="text-muted-foreground block truncate text-xs">
          /pages/{page.slug} · {PAGE_KIND_LABELS[page.kind]}
        </span>
      </Link>

      <label className="flex shrink-0 items-center gap-2 pr-1">
        <span className="text-muted-foreground hidden text-xs sm:inline">
          {page.isPublished ? 'Live' : 'Draft'}
        </span>
        <Switch
          checked={page.isPublished}
          onCheckedChange={(value) => onTogglePublished(page, value)}
          aria-label={`Publish ${page.titleEn}`}
        />
      </label>
    </li>
  );
}
