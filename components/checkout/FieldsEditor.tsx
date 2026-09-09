'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GripVerticalIcon, LockIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CHECKOUT_STEP_LABELS, type CheckoutFieldDto } from '@StrikerStore/contract';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { saveCheckoutFields } from '@/app/(dashboard)/checkout/actions';
import { Card, SaveBar } from './shared';
import { cn } from '@/lib/utils';

/**
 * Which fields checkout asks for, in what order, called what.
 *
 * The list itself is fixed — it comes from the catalogue in `shared/checkout.ts`
 * — because a field the admin invented would be one the storefront has no way
 * to render. What is editable is the order, the visibility, whether it is
 * required, and the label the customer reads.
 */
export function FieldsEditor({ initial }: { initial: CheckoutFieldDto[] }) {
  const router = useRouter();
  const [fields, setFields] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.key === active.id);
    const to = fields.findIndex((f) => f.key === over.id);
    if (from === -1 || to === -1) return;
    setFields(arrayMove(fields, from, to));
  }

  function update(key: string, changes: Partial<CheckoutFieldDto>) {
    setFields((current) =>
      current.map((field) => (field.key === key ? { ...field, ...changes } : field)),
    );
  }

  function save() {
    setFormError(null);
    startSaving(async () => {
      const result = await saveCheckoutFields({
        fields: fields.map((field) => ({
          key: field.key,
          // Only a label the shop actually changed is stored; matching the
          // catalogue default means "no override", so a later reword of the
          // default reaches this shop too.
          labelEn: field.labelEn,
          labelHi: field.labelHi,
          visible: field.visible,
          required: field.required,
        })),
      });

      if (!result.ok) {
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the fields below.');
        return;
      }
      toast.success('Fields saved');
      router.refresh();
    });
  }

  const asked = fields.filter((f) => f.visible).length;

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Fields"
        subtitle={`${asked} of ${fields.length} asked for. Drag to reorder — this is the order they appear in.`}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={fields.map((field) => field.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col divide-y rounded-md border">
              {fields.map((field) => (
                <Row key={field.key} field={field} onChange={update} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </Card>

      <SaveBar error={formError} isSaving={isSaving} onSave={save} label="Save fields" />
    </div>
  );
}

function Row({
  field,
  onChange,
}: {
  field: CheckoutFieldDto;
  onChange: (key: string, changes: Partial<CheckoutFieldDto>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.key,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-card flex flex-col gap-2 px-2 py-2.5',
        isDragging && 'relative z-10 shadow-lg',
        !field.visible && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none p-1"
          aria-label={`Reorder ${field.labelEn}`}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <Input
            value={field.labelEn}
            onChange={(e) => onChange(field.key, { labelEn: e.target.value })}
            className="h-8"
            aria-label={`Label for ${field.key}`}
          />
        </div>

        <div className="hidden min-w-0 flex-1 sm:block">
          <Input
            value={field.labelHi}
            onChange={(e) => onChange(field.key, { labelHi: e.target.value })}
            placeholder="हिन्दी"
            lang="hi"
            className="h-8"
            aria-label={`Hindi label for ${field.key}`}
          />
        </div>

        {field.locked ? (
          <span
            className="text-muted-foreground flex shrink-0 items-center gap-1 pr-1 text-xs"
            title="A delivery is impossible without this"
          >
            <LockIcon className="size-3.5" />
            Always asked
          </span>
        ) : (
          <div className="flex shrink-0 items-center gap-3 pr-1">
            <label className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Ask</span>
              <Switch
                checked={field.visible}
                onCheckedChange={(v) =>
                  // Turning a field off must turn off "required" with it: the
                  // server rejects a required field nobody can see, and leaving
                  // it set would make the next save fail for an invisible reason.
                  onChange(field.key, { visible: v, required: v ? field.required : false })
                }
                aria-label={`Ask for ${field.labelEn}`}
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Required</span>
              <Switch
                checked={field.required}
                disabled={!field.visible}
                onCheckedChange={(v) => onChange(field.key, { required: v })}
                aria-label={`Require ${field.labelEn}`}
              />
            </label>
          </div>
        )}
      </div>

      <p className="text-muted-foreground pl-8 text-xs">
        {CHECKOUT_STEP_LABELS[field.step]}
        {field.hint && ` · ${field.hint}`}
      </p>
    </li>
  );
}
