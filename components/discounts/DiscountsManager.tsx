'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircleIcon, PencilIcon, PlusIcon, TagIcon, TrashIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  describeDiscount,
  discountState,
  formatINR,
  formatStoreDate,
  DISCOUNT_STATE_LABELS,
  DISCOUNT_TRIGGERS,
  DISCOUNT_TRIGGER_LABELS,
  DISCOUNT_TYPES,
  DISCOUNT_TYPE_LABELS,
  type DiscountState,
  type DiscountTrigger,
  type DiscountType,
} from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  deleteDiscount,
  saveDiscount,
  setDiscountActive,
} from '@/app/(dashboard)/discounts/actions';
import { cn } from '@/lib/utils';

export type DiscountRow = {
  id: string;
  code: string | null;
  trigger: DiscountTrigger;
  type: DiscountType;
  value: string;
  minOrderValue: string | null;
  maxDiscountAmount: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usageCount: number;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  appliesToAll: boolean;
  categoryIds: string[];
  productIds: string[];
  tagIds: string[];
  redemptions: number;
};

type Option = { id: string; label: string };

const STATE_TONES: Record<DiscountState, string> = {
  ACTIVE: 'bg-[var(--success-bg)] text-[var(--success-fg)]',
  SCHEDULED: 'bg-[var(--info-bg)] text-[var(--info-fg)]',
  EXPIRED: 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)]',
  USED_UP: 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)]',
  OFF: 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)]',
};

/** Renders a Date as the `YYYY-MM-DDTHH:mm` a datetime-local input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EMPTY = {
  id: undefined as string | undefined,
  code: '',
  trigger: 'CODE' as DiscountTrigger,
  type: 'PERCENT' as DiscountType,
  value: '',
  minOrderValue: '',
  maxDiscountAmount: '',
  usageLimit: '',
  perCustomerLimit: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
  appliesToAll: true,
  categoryIds: [] as string[],
  productIds: [] as string[],
  tagIds: [] as string[],
};

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <span className="text-xs text-[var(--critical-fg)]">{error}</span>
      ) : (
        hint && <span className="text-muted-foreground text-xs">{hint}</span>
      )}
    </div>
  );
}

/** A scrollable checkbox list — used for all three narrowing dimensions. */
function TargetPicker({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{title}</Label>
      <ul className="max-h-[132px] overflow-y-auto rounded-md border p-1.5">
        {options.map((option) => (
          <li key={option.id}>
            <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1.5 py-1">
              <Checkbox
                checked={selected.includes(option.id)}
                onCheckedChange={() => onToggle(option.id)}
              />
              <span className="truncate">{option.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DiscountsManager({
  rows,
  categories,
  products,
  tags,
}: {
  rows: DiscountRow[];
  categories: Option[];
  products: Option[];
  tags: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<DiscountRow | null>(null);

  function openNew() {
    setForm({ ...EMPTY });
    setErrors({});
    setFormError(null);
    setOpen(true);
  }

  function openEdit(row: DiscountRow) {
    setForm({
      id: row.id,
      code: row.code ?? '',
      trigger: row.trigger,
      type: row.type,
      value: row.value,
      minOrderValue: row.minOrderValue ?? '',
      maxDiscountAmount: row.maxDiscountAmount ?? '',
      usageLimit: row.usageLimit ? String(row.usageLimit) : '',
      perCustomerLimit: row.perCustomerLimit ? String(row.perCustomerLimit) : '',
      startsAt: toLocalInput(row.startsAt),
      endsAt: toLocalInput(row.endsAt),
      isActive: row.isActive,
      appliesToAll: row.appliesToAll,
      categoryIds: row.categoryIds,
      productIds: row.productIds,
      tagIds: row.tagIds,
    });
    setErrors({});
    setFormError(null);
    setOpen(true);
  }

  function toggle(key: 'categoryIds' | 'productIds' | 'tagIds', id: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id)
        ? current[key].filter((value) => value !== id)
        : [...current[key], id],
    }));
  }

  function save() {
    setErrors({});
    setFormError(null);
    startSaving(async () => {
      const result = await saveDiscount(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success(result.data.code ? `${result.data.code} saved` : 'Discount saved');
      setOpen(false);
      router.refresh();
    });
  }

  function toggleActive(row: DiscountRow, next: boolean) {
    startSaving(async () => {
      const result = await setDiscountActive({ id: row.id, isActive: next });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not update that.');
        return;
      }
      router.refresh();
    });
  }

  function remove(row: DiscountRow) {
    startSaving(async () => {
      const result = await deleteDiscount({ id: row.id, isActive: row.isActive });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not delete that.');
        setConfirmDelete(null);
        return;
      }
      toast.success('Discount deleted');
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={openNew}>
          <PlusIcon className="size-4" />
          Create discount
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <TagIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <p className="font-medium">No discounts yet</p>
          <p className="text-muted-foreground max-w-[420px]">
            Create a code customers type at checkout, or one that applies on its own when an order
            qualifies.
          </p>
          <Button type="button" className="mt-1" onClick={openNew}>
            <PlusIcon className="size-4" />
            Create your first discount
          </Button>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium md:flex">
            <span className="min-w-0 flex-1">Discount</span>
            <span className="w-[110px] shrink-0">Status</span>
            <span className="w-[120px] shrink-0">Applies to</span>
            <span className="w-[90px] shrink-0 text-right">Used</span>
            <span className="w-[104px] shrink-0" />
          </div>

          <ul>
            {rows.map((row) => {
              const state = discountState({
                isActive: row.isActive,
                startsAt: new Date(row.startsAt),
                endsAt: row.endsAt ? new Date(row.endsAt) : null,
                usageLimit: row.usageLimit,
                usageCount: row.usageCount,
              });
              const targets = row.appliesToAll
                ? 'Everything'
                : [
                    row.categoryIds.length && `${row.categoryIds.length} categories`,
                    row.productIds.length && `${row.productIds.length} products`,
                    row.tagIds.length && `${row.tagIds.length} tags`,
                  ]
                    .filter(Boolean)
                    .join(', ');

              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {row.code ?? DISCOUNT_TRIGGER_LABELS.AUTOMATIC}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {describeDiscount(row)}
                      </span>
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {row.minOrderValue && `Over ${formatINR(row.minOrderValue)} · `}
                      {formatStoreDate(row.startsAt)}
                      {row.endsAt ? ` to ${formatStoreDate(row.endsAt)}` : ' onwards'}
                    </span>
                  </span>

                  <span className="w-[110px] shrink-0">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        STATE_TONES[state],
                      )}
                    >
                      {DISCOUNT_STATE_LABELS[state]}
                    </span>
                  </span>

                  <span className="text-muted-foreground w-[120px] shrink-0 truncate text-xs">
                    {targets}
                  </span>

                  <span className="tabular w-[90px] shrink-0 text-right text-xs">
                    {row.usageCount}
                    {row.usageLimit != null && (
                      <span className="text-muted-foreground"> / {row.usageLimit}</span>
                    )}
                  </span>

                  <span className="flex w-[104px] shrink-0 items-center justify-end gap-1.5">
                    <Switch
                      checked={row.isActive}
                      onCheckedChange={(next) => toggleActive(row, next)}
                      aria-label={row.isActive ? 'Switch off' : 'Switch on'}
                    />
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                      aria-label="Edit"
                    >
                      <PencilIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(row)}
                      className="text-muted-foreground p-1 transition-colors hover:text-[var(--critical-fg)]"
                      aria-label="Delete"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit discount' : 'Create discount'}</DialogTitle>
            <DialogDescription>
              What comes off, when it applies, and how often it can be used.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
              {formError}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="How it is triggered">
              <Select
                value={form.trigger}
                onValueChange={(v) => setForm((c) => ({ ...c, trigger: v as DiscountTrigger }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCOUNT_TRIGGERS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {DISCOUNT_TRIGGER_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {form.trigger === 'CODE' ? (
              <Field label="Code" htmlFor="code" error={errors.code}>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
                  placeholder="MONSOON20"
                  className="font-mono"
                />
              </Field>
            ) : (
              <div />
            )}

            <Field label="Type">
              <Select
                value={form.type}
                onValueChange={(v) => setForm((c) => ({ ...c, type: v as DiscountType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCOUNT_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {DISCOUNT_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {form.type !== 'FREE_DELIVERY' && (
              <Field
                label={form.type === 'PERCENT' ? 'Percentage off' : 'Amount off'}
                htmlFor="value"
                error={errors.value}
              >
                <Input
                  id="value"
                  value={form.value}
                  onChange={(e) => setForm((c) => ({ ...c, value: e.target.value }))}
                  inputMode="decimal"
                  className="tabular"
                  placeholder={form.type === 'PERCENT' ? '20' : '250'}
                />
              </Field>
            )}

            {form.type === 'PERCENT' && (
              <Field
                label="Cap the discount at"
                htmlFor="cap"
                error={errors.maxDiscountAmount}
                hint="Optional. Stops a percentage running away on a large order."
              >
                <Input
                  id="cap"
                  value={form.maxDiscountAmount}
                  onChange={(e) => setForm((c) => ({ ...c, maxDiscountAmount: e.target.value }))}
                  inputMode="decimal"
                  className="tabular"
                />
              </Field>
            )}

            <Field
              label="Minimum order"
              htmlFor="min"
              error={errors.minOrderValue}
              hint="Optional."
            >
              <Input
                id="min"
                value={form.minOrderValue}
                onChange={(e) => setForm((c) => ({ ...c, minOrderValue: e.target.value }))}
                inputMode="decimal"
                className="tabular"
              />
            </Field>

            <Field label="Starts" htmlFor="starts" hint="Leave blank to start now.">
              <Input
                id="starts"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((c) => ({ ...c, startsAt: e.target.value }))}
              />
            </Field>
            <Field label="Ends" htmlFor="ends" error={errors.endsAt} hint="Leave blank for no end.">
              <Input
                id="ends"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((c) => ({ ...c, endsAt: e.target.value }))}
              />
            </Field>

            <Field
              label="Total uses"
              htmlFor="limit"
              error={errors.usageLimit}
              hint="Blank means unlimited."
            >
              <Input
                id="limit"
                value={form.usageLimit}
                onChange={(e) => setForm((c) => ({ ...c, usageLimit: e.target.value }))}
                inputMode="numeric"
                className="tabular"
              />
            </Field>
            <Field
              label="Uses per customer"
              htmlFor="per"
              error={errors.perCustomerLimit}
              hint="Blank means unlimited."
            >
              <Input
                id="per"
                value={form.perCustomerLimit}
                onChange={(e) => setForm((c) => ({ ...c, perCustomerLimit: e.target.value }))}
                inputMode="numeric"
                className="tabular"
              />
            </Field>
          </div>

          <label className="flex items-start gap-2.5 border-t pt-3">
            <Checkbox
              checked={form.appliesToAll}
              onCheckedChange={(checked) =>
                setForm((c) => ({ ...c, appliesToAll: checked === true }))
              }
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Applies to the whole order</span>
              <span className="text-muted-foreground text-xs">
                {/* Narrowing matters: a "20% off cement" that quietly discounted
                    plywood too would be invisible on the order afterwards. */}
                Untick to limit it to certain categories, products or tags.
              </span>
            </span>
          </label>
          {errors.appliesToAll && (
            <span className="text-xs text-[var(--critical-fg)]">{errors.appliesToAll}</span>
          )}

          {!form.appliesToAll && (
            <div className="grid gap-3 sm:grid-cols-3">
              <TargetPicker
                title="Categories"
                options={categories}
                selected={form.categoryIds}
                onToggle={(id) => toggle('categoryIds', id)}
              />
              <TargetPicker
                title="Tags"
                options={tags}
                selected={form.tagIds}
                onToggle={(id) => toggle('tagIds', id)}
              />
              <TargetPicker
                title="Products"
                options={products}
                selected={form.productIds}
                onToggle={(id) => toggle('productIds', id)}
              />
            </div>
          )}

          <label className="flex items-center justify-between gap-4 border-t pt-3">
            <span className="font-medium">Switched on</span>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((c) => ({ ...c, isActive: v }))}
            />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSaving} onClick={save}>
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              {form.id ? 'Save discount' : 'Create discount'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(n) => !n && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.code ?? 'this discount'}?</DialogTitle>
            <DialogDescription>
              {confirmDelete && confirmDelete.usageCount > 0
                ? 'This one has been used on real orders, so it can only be switched off — deleting it would change what those orders say they cost.'
                : 'It has never been used, so nothing else is affected.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving}
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
