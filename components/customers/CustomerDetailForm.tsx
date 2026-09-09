'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BanIcon, CheckIcon, LoaderCircleIcon, ShieldCheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { setCustomerBlocked, updateCustomer } from '@/app/(dashboard)/customers/actions';

export function CustomerDetailForm({
  customerId,
  phone,
  name,
  email,
  locale,
  notes,
  isBlocked,
}: {
  customerId: string;
  phone: string;
  name: string | null;
  email: string | null;
  locale: 'en' | 'hi';
  notes: string | null;
  isBlocked: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: name ?? '',
    email: email ?? '',
    locale,
    notes: notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [confirmBlock, setConfirmBlock] = useState(false);

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await updateCustomer({ customerId, ...form });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Saved');
      router.refresh();
    });
  }

  function toggleBlocked(next: boolean) {
    startSaving(async () => {
      const result = await setCustomerBlocked({ customerId, isBlocked: next });
      if (!result.ok) {
        toast.error(result.formErrors[0] ?? 'Could not update that.');
        return;
      }
      toast.success(next ? 'Customer blocked' : 'Customer unblocked');
      setConfirmBlock(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Phone</Label>
          <Input value={phone} readOnly disabled className="tabular" />
          <span className="text-muted-foreground text-xs">
            The phone is how a customer is identified, so it cannot be edited here.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cust-name">Name</Label>
          <Input
            id="cust-name"
            value={form.name}
            onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cust-email">Email</Label>
          <Input
            id="cust-email"
            value={form.email}
            onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
          />
          {errors.email && (
            <span className="text-xs text-[var(--critical-fg)]">{errors.email}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Language</Label>
          <Select
            value={form.locale}
            onValueChange={(value) => setForm((c) => ({ ...c, locale: value as 'en' | 'hi' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">हिन्दी</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cust-notes">Internal note</Label>
          <Textarea
            id="cust-notes"
            value={form.notes}
            onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
            rows={3}
            placeholder="Buys cement every fortnight, prefers morning delivery"
          />
        </div>

        <Button type="button" disabled={isSaving} onClick={save}>
          {isSaving ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          Save details
        </Button>

        <div className="border-t pt-3">
          {isBlocked ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isSaving}
              onClick={() => toggleBlocked(false)}
            >
              <ShieldCheckIcon className="size-4" />
              Unblock customer
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full text-[var(--critical-fg)] hover:text-[var(--critical-fg)]"
              disabled={isSaving}
              onClick={() => setConfirmBlock(true)}
            >
              <BanIcon className="size-4" />
              Block customer
            </Button>
          )}
        </div>
      </div>

      <Dialog open={confirmBlock} onOpenChange={(open) => !open && setConfirmBlock(false)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Block {name ?? phone}?</DialogTitle>
            <DialogDescription>
              {/* Blocking is about what happens next, never about the past — the
                  goods on existing orders were still bought and still owed. */}
              They will not be able to place new orders, on the storefront or here. Existing orders
              carry on as normal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmBlock(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving}
              onClick={() => toggleBlocked(true)}
            >
              {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
              Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
