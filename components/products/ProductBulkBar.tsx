'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircleIcon, XIcon, TagIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { bulkEditTags, bulkSetStatus } from '@/app/(dashboard)/products/bulk-actions';

export type BulkTagOption = { id: string; nameEn: string };

/**
 * Actions over a selection of products.
 *
 * The whole point of tagging at catalogue scale: marking forty products as
 * Clearance should be one action, not forty trips through a form.
 */
export function ProductBulkBar({
  selectedIds,
  allTags,
  onClear,
}: {
  selectedIds: string[];
  allTags: BulkTagOption[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [tagOpen, setTagOpen] = useState(false);
  const [addDraft, setAddDraft] = useState('');
  const [addNames, setAddNames] = useState<string[]>([]);
  const [removeIds, setRemoveIds] = useState<Set<string>>(new Set());
  const [isSaving, startSaving] = useTransition();

  if (selectedIds.length === 0) return null;

  function addTag(raw: string) {
    const parts = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const existing = new Set(addNames.map((n) => n.toLowerCase()));
    const additions = parts.filter((p) => !existing.has(p.toLowerCase()));
    if (additions.length > 0) setAddNames([...addNames, ...additions]);
    setAddDraft('');
  }

  function applyTags() {
    startSaving(async () => {
      const result = await bulkEditTags({
        productIds: selectedIds,
        addTagNames: addNames,
        removeTagIds: [...removeIds],
      });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not update tags.');
        return;
      }
      const { added, removed, products } = result.data;
      toast.success(
        `${products} product${products === 1 ? '' : 's'} updated — ${added} tag${added === 1 ? '' : 's'} added, ${removed} removed`,
      );
      setTagOpen(false);
      setAddNames([]);
      setRemoveIds(new Set());
      onClear();
      router.refresh();
    });
  }

  function applyStatus(status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED') {
    startSaving(async () => {
      const result = await bulkSetStatus({ productIds: selectedIds, status });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not change status.');
        return;
      }
      toast.success(`${result.data.updated} product${result.data.updated === 1 ? '' : 's'} set to ${status.toLowerCase()}`);
      onClear();
      router.refresh();
    });
  }

  return (
    <>
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-[var(--shadow-card)]">
        <span className="font-medium">{selectedIds.length} selected</span>
        <div className="flex-1" />

        <Button type="button" variant="outline" size="sm" onClick={() => setTagOpen(true)}>
          <TagIcon className="size-4" />
          Edit tags
        </Button>

        <Select onValueChange={(v) => applyStatus(v as 'DRAFT' | 'ACTIVE' | 'ARCHIVED')}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Set status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Button type="button" variant="ghost" size="sm" onClick={onClear} aria-label="Clear selection">
          <XIcon className="size-4" />
        </Button>
      </div>

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit tags</DialogTitle>
            <DialogDescription>
              Applies to {selectedIds.length} selected product
              {selectedIds.length === 1 ? '' : 's'}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-add">Add tags</Label>
            {addNames.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {addNames.map((name) => (
                  <li
                    key={name}
                    className="bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => setAddNames(addNames.filter((n) => n !== name))}
                      aria-label={`Remove ${name}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Input
              id="bulk-add"
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              onBlur={() => addTag(addDraft)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(addDraft);
                }
              }}
              placeholder="Clearance, Bestseller"
              maxLength={191}
            />
            <p className="text-muted-foreground text-xs">
              New tags are created as internal. Make one public from the Tags screen.
            </p>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Remove tags</Label>
              <ul className="max-h-[180px] overflow-y-auto rounded-md border p-2">
                {allTags.map((tag) => (
                  <li key={tag.id} className="flex items-center gap-2 py-0.5">
                    <Checkbox
                      id={`rm-${tag.id}`}
                      checked={removeIds.has(tag.id)}
                      onCheckedChange={(v) =>
                        setRemoveIds((current) => {
                          const next = new Set(current);
                          if (v) next.add(tag.id);
                          else next.delete(tag.id);
                          return next;
                        })
                      }
                    />
                    <label htmlFor={`rm-${tag.id}`} className="text-xs">
                      {tag.nameEn}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTagOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={applyTags}
              disabled={isSaving || (addNames.length === 0 && removeIds.size === 0)}
            >
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
