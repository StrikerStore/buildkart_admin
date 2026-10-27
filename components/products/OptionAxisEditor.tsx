'use client';

import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlusIcon, XIcon, GripVerticalIcon } from 'lucide-react';
import { MAX_OPTION_AXES, type OptionAxisDraft } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Defines the option axes. Names and values are entirely admin-authored free
 * text — nothing is predefined in code, because the vocabulary of a
 * construction catalog ("Grade", "Gauge", "Sheet thickness") is not knowable
 * up front.
 */
export function OptionAxisEditor({
  axes,
  onChange,
  onRenameValue,
}: {
  axes: OptionAxisDraft[];
  onChange: (next: OptionAxisDraft[]) => void;
  /** Lets the parent re-key existing variants so a rename is non-destructive. */
  onRenameValue: (axisIndex: number, oldValue: string, newValue: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {axes.map((axis, axisIndex) => (
        <AxisRow
          key={axisIndex}
          axis={axis}
          index={axisIndex}
          canRemove={axes.length > 1}
          onChange={(next) => onChange(axes.map((a, i) => (i === axisIndex ? next : a)))}
          onRemove={() => onChange(axes.filter((_, i) => i !== axisIndex))}
          onRenameValue={(oldValue, newValue) => onRenameValue(axisIndex, oldValue, newValue)}
        />
      ))}

      {axes.length < MAX_OPTION_AXES && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onChange([...axes, { name: '', values: [] }])}
        >
          <PlusIcon className="size-4" />
          Add another option
        </Button>
      )}
    </div>
  );
}

function AxisRow({
  axis,
  index,
  canRemove,
  onChange,
  onRemove,
  onRenameValue,
}: {
  axis: OptionAxisDraft;
  index: number;
  canRemove: boolean;
  onChange: (next: OptionAxisDraft) => void;
  onRemove: () => void;
  onRenameValue: (oldValue: string, newValue: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ index: number; value: string } | null>(null);
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on the grip is
    // not swallowed as a zero-length drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /*
   * The order here is the order the storefront shows the buttons in: it is
   * saved as each value's position, and the variant rows below follow it.
   * Values are unique within an axis (adding and renaming both refuse a
   * case-insensitive duplicate), so the value itself is a stable sortable id.
   */
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = axis.values.indexOf(String(active.id));
    const to = axis.values.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onChange({ ...axis, values: arrayMove(axis.values, from, to) });
  }

  function addValues(raw: string) {
    // Commas let a whole size run be pasted in one go: "8mm, 10mm, 12mm".
    const parts = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (parts.length === 0) return;

    const existing = new Set(axis.values.map((v) => v.toLowerCase()));
    const additions = parts.filter((p) => !existing.has(p.toLowerCase()));
    if (additions.length > 0) onChange({ ...axis, values: [...axis.values, ...additions] });
    setDraft('');
  }

  function commitRename() {
    if (!editing) return;
    const oldValue = axis.values[editing.index];
    const newValue = editing.value.trim();
    setEditing(null);

    if (!oldValue || newValue === '' || newValue === oldValue) return;
    if (axis.values.some((v, i) => i !== editing.index && v.toLowerCase() === newValue.toLowerCase())) {
      return; // would collide with a sibling value
    }

    onChange({
      ...axis,
      values: axis.values.map((v, i) => (i === editing.index ? newValue : v)),
    });
    // Tell the parent so it can carry the variants across to the new key.
    onRenameValue(oldValue, newValue);
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`axis-${index}`}>Option {index + 1} name</Label>
          <Input
            id={`axis-${index}`}
            value={axis.name}
            onChange={(e) => onChange({ ...axis, name: e.target.value })}
            placeholder={index === 0 ? 'Size' : 'Grade'}
            maxLength={191}
          />
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remove option ${axis.name || index + 1}`}
          >
            <XIcon className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`axis-${index}-values`}>Values</Label>

        {axis.values.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={axis.values} strategy={rectSortingStrategy}>
              <ul className="flex flex-wrap gap-1.5">
                {axis.values.map((value, valueIndex) => (
                  <SortableValue key={value} value={value} disabled={editing !== null}>
                    {(handle) =>
                      editing?.index === valueIndex ? (
                        <Input
                          autoFocus
                          value={editing.value}
                          onChange={(e) => setEditing({ index: valueIndex, value: e.target.value })}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitRename();
                            } else if (e.key === 'Escape') {
                              setEditing(null);
                            }
                          }}
                          className="h-7 w-28"
                        />
                      ) : (
                        <span className="bg-card flex items-center gap-1 rounded border px-2 py-1">
                          {handle}
                          <button
                            type="button"
                            onClick={() => setEditing({ index: valueIndex, value })}
                            className="font-medium"
                          >
                            {value}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onChange({ ...axis, values: axis.values.filter((_, i) => i !== valueIndex) })
                            }
                            aria-label={`Remove value ${value}`}
                            className="text-muted-foreground hover:text-[var(--critical-fg)]"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      )
                    }
                  </SortableValue>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <Input
          id={`axis-${index}-values`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => addValues(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addValues(draft);
            }
          }}
          placeholder={axis.values.length === 0 ? '8mm, 10mm, 12mm' : 'Add another value'}
          maxLength={191}
        />
        <p className="text-muted-foreground text-xs">
          Press Enter or comma to add. Click a value to rename it — prices and stock move with it.
          Drag the handle to reorder; the website shows them in this order.
        </p>
      </div>
    </div>
  );
}

/**
 * One value chip, draggable by its grip only — the name stays a click target
 * for renaming and the cross for removing, so neither starts a drag.
 */
function SortableValue({
  value,
  disabled,
  children,
}: {
  value: string;
  /** Off while any value is being renamed, so the open input cannot be dragged away. */
  disabled: boolean;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value,
    disabled,
  });

  const handle = (
    <button
      type="button"
      className="text-muted-foreground -ml-0.5 cursor-grab touch-none active:cursor-grabbing"
      aria-label={`Reorder ${value}`}
      {...attributes}
      {...listeners}
    >
      <GripVerticalIcon className="size-3" />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 shadow-[var(--shadow-popover)]')}
    >
      {children(handle)}
    </li>
  );
}
