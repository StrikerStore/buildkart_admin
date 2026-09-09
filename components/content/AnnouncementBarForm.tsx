'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LoaderCircleIcon,
  MegaphoneIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { ANNOUNCEMENT_TEXT_LIMIT, type AnnouncementBarDto } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { saveAnnouncementBar } from '@/app/(dashboard)/announcements/actions';
import { cn } from '@/lib/utils';

type Item = AnnouncementBarDto['items'][number];

const EMPTY_ITEM: Item = { textEn: '', textHi: '', url: '', isActive: true };

const MAX_ITEMS = 10;

export function AnnouncementBarForm({ initial }: { initial: AnnouncementBarDto }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  /*
   * The interval is held as a string while it is being typed. A number would
   * make clearing the field mean zero, and the form would fight the person
   * backspacing from "15" to "5".
   */
  const [rotate, setRotate] = useState(String(initial.rotateSeconds));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function patchItem(index: number, changes: Partial<Item>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    }));
  }

  function addItem() {
    setForm((current) => ({ ...current, items: [...current.items, { ...EMPTY_ITEM }] }));
  }

  function removeItem(index: number) {
    setForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= form.items.length) return;
    setForm((current) => {
      const next = [...current.items];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return { ...current, items: next };
    });
  }

  function save() {
    setFormError(null);
    startSaving(async () => {
      const result = await saveAnnouncementBar({ ...form, rotateSeconds: rotate });
      if (!result.ok) {
        const message =
          result.formErrors[0] ?? Object.values(result.fieldErrors)[0] ?? 'Check the form.';
        setFormError(message);
        toast.error(message);
        return;
      }
      toast.success('Announcement bar saved');
      router.refresh();
    });
  }

  /*
   * What the shop will actually show, which is not what is typed here: an empty
   * row, a switched-off row and the bar's own switch each take messages out of
   * the running. The preview reads from this rather than from `form.items`, so
   * it cannot promise something the storefront will not render.
   */
  const live = form.enabled ? form.items.filter((i) => i.isActive && i.textEn.trim() !== '') : [];

  return (
    <div className="flex flex-col gap-4">
      {formError && (
        <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
          {formError}
        </p>
      )}

      <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <label className="flex items-center justify-between gap-4">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Show the bar</span>
            <span className="text-muted-foreground text-xs">
              Off hides the strip everywhere without deleting what is in it.
            </span>
          </span>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm((c) => ({ ...c, enabled: v }))}
          />
        </label>

        {/* Meaningless with nothing to rotate between, so it is not offered
            until there is a second message. */}
        {form.items.length > 1 && (
          <div className="flex flex-col gap-1.5 border-t pt-4">
            <Label htmlFor="rotate">Seconds on each message</Label>
            <Input
              id="rotate"
              value={rotate}
              onChange={(e) => setRotate(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className="tabular w-[100px]"
            />
            <span className="text-muted-foreground text-xs">
              Between 2 and 30. Five suits a short line; a longer one in Hindi needs more.
            </span>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs">On the shop</span>
        <div className="overflow-hidden rounded-lg border">
          <div className="flex h-8 items-center justify-center bg-[var(--foreground)] px-3">
            <span className="truncate text-xs text-[var(--background)]">
              {live[0]?.textEn || 'Nothing showing'}
            </span>
          </div>
          {/* A stand-in for the header underneath, so the strip is seen in
              proportion rather than as a box on its own. */}
          <div className="bg-muted/40 h-10" />
        </div>
        {live.length > 1 && (
          <span className="text-muted-foreground text-xs">
            {live.length} messages, each held {rotate || '5'} seconds.
          </span>
        )}
      </section>

      <section className="flex flex-col gap-3">
        {form.items.length === 0 ? (
          <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-12 text-center shadow-[var(--shadow-card)]">
            <MegaphoneIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
            <p className="font-medium">No announcements yet</p>
            <p className="text-muted-foreground max-w-[420px]">
              Free delivery over a cutoff, a festival closure, a new brand — the things worth
              saying on every page.
            </p>
          </div>
        ) : (
          form.items.map((item, index) => (
            /*
             * Keyed by position, which is normally a mistake — but these rows
             * have no id of their own (the whole bar is one Setting row), and
             * reordering swaps the contents rather than moving a row with state
             * attached to it. There is nothing here for React to preserve.
             */
            <div
              key={index}
              className={cn(
                'bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]',
                !item.isActive && 'opacity-60',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUpIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === form.items.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDownIcon className="size-4" />
                  </button>
                </span>

                <span className="text-muted-foreground tabular w-6 shrink-0 text-center text-xs">
                  {index + 1}
                </span>

                <span className="flex-1" />

                <Switch
                  checked={item.isActive}
                  onCheckedChange={(v) => patchItem(index, { isActive: v })}
                  aria-label="Show this message"
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-muted-foreground p-1 hover:text-[var(--critical-fg)]"
                  aria-label="Remove this message"
                >
                  <TrashIcon className="size-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`text-${index}`}>Message</Label>
                  <Input
                    id={`text-${index}`}
                    value={item.textEn}
                    maxLength={ANNOUNCEMENT_TEXT_LIMIT}
                    onChange={(e) => patchItem(index, { textEn: e.target.value })}
                    placeholder="Free delivery on orders over 10,000"
                  />
                  <Counter value={item.textEn.length} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`text-hi-${index}`}>Message (Hindi)</Label>
                  <Input
                    id={`text-hi-${index}`}
                    value={item.textHi}
                    maxLength={ANNOUNCEMENT_TEXT_LIMIT}
                    onChange={(e) => patchItem(index, { textHi: e.target.value })}
                  />
                  <Counter value={item.textHi.length} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`url-${index}`}>Links to</Label>
                <Input
                  id={`url-${index}`}
                  value={item.url}
                  onChange={(e) => patchItem(index, { url: e.target.value })}
                  placeholder="/category/cement — leave empty for plain text"
                />
              </div>
            </div>
          ))
        )}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={addItem}
            disabled={form.items.length >= MAX_ITEMS}
          >
            <PlusIcon className="size-4" />
            Add message
          </Button>
          {form.items.length >= MAX_ITEMS && (
            <span className="text-muted-foreground text-xs">
              Ten is the limit — past that nobody waits for the last one.
            </span>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" disabled={isSaving} onClick={save}>
          {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

/**
 * Counts up to a wall rather than warning about one.
 *
 * The limit is enforced by the schema and again by `maxLength`, so this is not
 * advice — it is the explanation for why typing stopped, which is otherwise a
 * form that looks broken.
 */
function Counter({ value }: { value: number }) {
  return (
    <span
      className={cn(
        'text-muted-foreground tabular text-xs',
        value >= ANNOUNCEMENT_TEXT_LIMIT && 'text-[var(--warning-fg)]',
      )}
    >
      {value}/{ANNOUNCEMENT_TEXT_LIMIT}
    </span>
  );
}
