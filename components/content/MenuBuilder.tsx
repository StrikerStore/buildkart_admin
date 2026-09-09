'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CornerDownRightIcon,
  LoaderCircleIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MENU_TARGET_KINDS,
  MENU_TARGET_LABELS,
  type MenuDto,
  type MenuTargetKind,
  type MenuTargetOptionsDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveMenu } from '@/app/(dashboard)/menus/actions';
import { cn } from '@/lib/utils';

type Draft = {
  labelEn: string;
  labelHi: string;
  targetKind: MenuTargetKind;
  targetId: string;
  url: string;
  isActive: boolean;
};

type TopDraft = Draft & { children: Draft[] };

const blank = (): Draft => ({
  labelEn: '',
  labelHi: '',
  targetKind: 'CATEGORY',
  targetId: '',
  url: '',
  isActive: true,
});

/**
 * The menu builder.
 *
 * The whole menu saves at once rather than row by row: reordering, re-nesting
 * and relabelling are one gesture here, and applying them piecemeal would let a
 * failure halfway through leave the header with a link in two places or none.
 *
 * Ordering is by up/down buttons rather than drag. A nested list has two axes —
 * position and depth — and a drag that can change both at once is hard to aim
 * on a phone, which is where this shop is run from.
 */
export function MenuBuilder({
  menu,
  targets,
}: {
  menu: MenuDto;
  targets: MenuTargetOptionsDto;
}) {
  const router = useRouter();

  const [items, setItems] = useState<TopDraft[]>(() =>
    menu.items.map((item) => ({
      labelEn: item.labelEn,
      labelHi: item.labelHi,
      targetKind: item.targetKind,
      targetId: item.targetId ?? '',
      url: item.url,
      isActive: item.isActive,
      children: item.children.map((child) => ({
        labelEn: child.labelEn,
        labelHi: child.labelHi,
        targetKind: child.targetKind,
        targetId: child.targetId ?? '',
        url: child.url,
        isActive: child.isActive,
      })),
    })),
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function updateTop(index: number, changes: Partial<TopDraft>) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    );
  }

  function updateChild(top: number, child: number, changes: Partial<Draft>) {
    setItems((current) =>
      current.map((item, i) =>
        i === top
          ? {
              ...item,
              children: item.children.map((c, j) => (j === child ? { ...c, ...changes } : c)),
            }
          : item,
      ),
    );
  }

  function move(index: number, delta: number) {
    setItems((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function save() {
    setFormError(null);
    startSaving(async () => {
      const result = await saveMenu({
        handle: menu.handle,
        items: items.map((item) => ({
          ...item,
          targetId: item.targetId || undefined,
          url: item.url || undefined,
          children: item.children.map((child) => ({
            ...child,
            targetId: child.targetId || undefined,
            url: child.url || undefined,
          })),
        })),
      });

      if (!result.ok) {
        setFormError(result.formErrors[0] ?? 'Check the links below.');
        toast.error(result.formErrors[0] ?? 'Could not save the menu.');
        return;
      }
      toast.success(`${menu.nameEn} saved`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 && (
        <p className="bg-card text-muted-foreground rounded-lg border px-6 py-10 text-center shadow-[var(--shadow-card)]">
          Nothing in this menu yet.
        </p>
      )}

      {items.map((item, index) => (
        <section
          key={index}
          className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-start gap-2">
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
                className="text-muted-foreground hover:text-foreground rounded p-0.5 disabled:opacity-30"
              >
                <ChevronUpIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Move down"
                className="text-muted-foreground hover:text-foreground rounded p-0.5 disabled:opacity-30"
              >
                <ChevronDownIcon className="size-4" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <LinkFields
                value={item}
                targets={targets}
                onChange={(changes) => updateTop(index, changes)}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Switch
                checked={item.isActive}
                onCheckedChange={(v) => updateTop(index, { isActive: v })}
                aria-label="Show this link"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remove this link"
                onClick={() => setItems((c) => c.filter((_, i) => i !== index))}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          </div>

          {item.children.length > 0 && (
            <ul className="flex flex-col gap-3 border-l pl-4">
              {item.children.map((child, childIndex) => (
                <li key={childIndex} className="flex items-start gap-2">
                  <CornerDownRightIcon className="text-muted-foreground mt-2 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <LinkFields
                      value={child}
                      targets={targets}
                      onChange={(changes) => updateChild(index, childIndex, changes)}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={child.isActive}
                      onCheckedChange={(v) => updateChild(index, childIndex, { isActive: v })}
                      aria-label="Show this link"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Remove this link"
                      onClick={() =>
                        updateTop(index, {
                          children: item.children.filter((_, j) => j !== childIndex),
                        })
                      }
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => updateTop(index, { children: [...item.children, blank()] })}
          >
            <PlusIcon className="size-4" />
            Add a sub-link
          </Button>
        </section>
      ))}

      {formError && (
        <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setItems((c) => [...c, { ...blank(), children: [] }])}
        >
          <PlusIcon className="size-4" />
          Add a link
        </Button>
        <Button type="button" disabled={isSaving} onClick={save}>
          {isSaving ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          Save {menu.nameEn.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}

/** Label, what it points at, and — for a raw URL only — the address. */
function LinkFields({
  value,
  targets,
  onChange,
}: {
  value: Draft;
  targets: MenuTargetOptionsDto;
  onChange: (changes: Partial<Draft>) => void;
}) {
  const options =
    value.targetKind === 'CATEGORY'
      ? targets.categories
      : value.targetKind === 'PAGE'
        ? targets.pages
        : value.targetKind === 'BLOG'
          ? targets.posts
          : value.targetKind === 'PRODUCT'
            ? targets.products
            : [];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <Label className="sr-only">Label</Label>
        <Input
          value={value.labelEn}
          onChange={(e) => onChange({ labelEn: e.target.value })}
          placeholder="Label"
        />
      </div>

      <Select
        value={value.targetKind}
        onValueChange={(v) =>
          // Clearing the target on a kind change is deliberate: an id from the
          // previous kind names nothing in the new one.
          onChange({ targetKind: v as MenuTargetKind, targetId: '', url: '' })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MENU_TARGET_KINDS.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {MENU_TARGET_LABELS[kind]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.targetKind === 'URL' ? (
        <Input
          value={value.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://…"
          className={cn('font-mono', !value.url && 'border-[var(--critical-fg)]')}
        />
      ) : (
        <Select value={value.targetId} onValueChange={(v) => onChange({ targetId: v })}>
          <SelectTrigger className={cn(!value.targetId && 'border-[var(--critical-fg)]')}>
            <SelectValue placeholder={`Choose a ${MENU_TARGET_LABELS[value.targetKind].toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
