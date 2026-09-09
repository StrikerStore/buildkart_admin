'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  DndContext,
  KeyboardSensor,
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon, CornerDownRightIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { reorderCategories } from '@/app/(dashboard)/categories/actions';
import type { CategoryDto } from '@StrikerStore/contract';

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        isActive
          ? 'bg-[var(--success-bg)] text-[var(--success-fg)]'
          : 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)]',
      )}
    >
      {isActive ? 'Active' : 'Hidden'}
    </span>
  );
}

function SortableRow({
  category,
  childCategories,
}: {
  category: CategoryDto;
  childCategories: CategoryDto[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-card border-b last:border-b-0',
        isDragging && 'relative z-10 shadow-[var(--shadow-popover)]',
      )}
    >
      <div className="flex items-center gap-1 px-2 py-2.5">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab rounded p-1 active:cursor-grabbing"
          aria-label={`Reorder ${category.nameEn}`}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>

        <Link href={`/categories/${category.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded px-1 py-0.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{category.nameEn}</span>
            {category.nameHi && (
              <span className="text-muted-foreground block truncate text-xs" lang="hi">
                {category.nameHi}
              </span>
            )}
          </span>

          <span className="text-muted-foreground hidden shrink-0 font-mono text-xs sm:block">
            /{category.slug}
          </span>

          <span className="text-muted-foreground tabular hidden w-20 shrink-0 text-right text-xs sm:block">
            {category.productCount} product{category.productCount === 1 ? '' : 's'}
          </span>

          {category.isRateVolatile && (
            <span className="hidden shrink-0 rounded-full bg-[var(--brand-subdued)] px-2 py-0.5 text-xs font-medium text-[var(--brand-foreground)] md:block">
              Daily rate
            </span>
          )}

          <StatusBadge isActive={category.isActive} />
        </Link>
      </div>

      {/* Children are shown for context but are not themselves draggable here —
          reordering is always within one sibling set, never across levels. */}
      {childCategories.length > 0 && (
        <ul className="border-t bg-[var(--muted)]">
          {childCategories.map((child) => (
            <li key={child.id} className="border-b last:border-b-0">
              <Link
                href={`/categories/${child.id}`}
                className="flex items-center gap-2 py-2 pr-3 pl-9"
              >
                <CornerDownRightIcon className="text-muted-foreground size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{child.nameEn}</span>
                <span className="text-muted-foreground tabular hidden shrink-0 text-xs sm:block">
                  {child.productCount} product{child.productCount === 1 ? '' : 's'}
                </span>
                <StatusBadge isActive={child.isActive} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function CategoryList({ categories }: { categories: CategoryDto[] }) {
  const roots = categories.filter((c) => c.parentId === null);
  const [order, setOrder] = useState(roots);
  const [, startSaving] = useTransition();

  // Re-sync when the server sends a new list (after a create, edit or delete).
  useEffect(() => {
    setOrder(categories.filter((c) => c.parentId === null));
  }, [categories]);

  const sensors = useSensors(
    // A small activation distance keeps a click on the row from being swallowed
    // as a drag — the whole row is a link, so this matters.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = order.findIndex((c) => c.id === active.id);
    const to = order.findIndex((c) => c.id === over.id);
    if (from === -1 || to === -1) return;

    const previous = order;
    const next = arrayMove(order, from, to);
    setOrder(next); // optimistic

    startSaving(async () => {
      const result = await reorderCategories({
        parentId: null,
        orderedIds: next.map((c) => c.id),
      });
      if (!result.ok) {
        setOrder(previous); // roll back to what the server still believes
        toast.error(result.formErrors[0] ?? 'Could not save the new order.');
      }
    });
  }

  if (categories.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={order.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          {order.map((category) => (
            <SortableRow
              key={category.id}
              category={category}
              childCategories={categories.filter((c) => c.parentId === category.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
