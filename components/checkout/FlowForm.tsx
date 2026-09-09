'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  CHECKOUT_LAYOUTS,
  CHECKOUT_LAYOUT_HINTS,
  CHECKOUT_LAYOUT_LABELS,
  CHECKOUT_STEPS,
  CHECKOUT_STEP_HINTS,
  CHECKOUT_STEP_LABELS,
  PROGRESS_STYLES,
  PROGRESS_STYLE_LABELS,
  REQUIRED_STEPS,
  type CheckoutConfigDto,
  type CheckoutStep,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveCheckoutFlow } from '@/app/(dashboard)/checkout/actions';
import { Card, SaveBar, Toggle } from './shared';
import { cn } from '@/lib/utils';

export function FlowForm({ initial }: { initial: CheckoutConfigDto['flow'] }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /** Steps not currently in the flow, offered for adding back. */
  const missing = CHECKOUT_STEPS.filter((step) => !form.steps.includes(step));

  function move(index: number, delta: number) {
    setForm((current) => {
      const steps = [...current.steps];
      const target = index + delta;
      if (target < 0 || target >= steps.length) return current;
      [steps[index], steps[target]] = [steps[target]!, steps[index]!];
      return { ...current, steps };
    });
  }

  function save() {
    setFormError(null);
    startSaving(async () => {
      const result = await saveCheckoutFlow(form);
      if (!result.ok) {
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the flow below.');
        return;
      }
      toast.success('Flow saved');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Layout">
        <div className="grid gap-2 sm:grid-cols-2">
          {CHECKOUT_LAYOUTS.map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => set('layout', layout)}
              aria-pressed={form.layout === layout}
              className={cn(
                'flex flex-col gap-1 rounded-md border p-3 text-left transition-colors',
                form.layout === layout
                  ? 'border-[var(--nav)] bg-[var(--nav)]/5'
                  : 'hover:bg-muted/40',
              )}
            >
              <span className="font-medium">{CHECKOUT_LAYOUT_LABELS[layout]}</span>
              <span className="text-muted-foreground text-xs">
                {CHECKOUT_LAYOUT_HINTS[layout]}
              </span>
            </button>
          ))}
        </div>

        {form.layout === 'MULTI_STEP' && (
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Progress indicator</span>
            <Select
              value={form.progressStyle}
              onValueChange={(v) => set('progressStyle', v as typeof form.progressStyle)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROGRESS_STYLES.map((style) => (
                  <SelectItem key={style} value={style}>
                    {PROGRESS_STYLE_LABELS[style]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      <Card
        title="Steps"
        subtitle={
          form.layout === 'ONE_PAGE'
            ? 'On a one-page checkout this is the order the sections appear in.'
            : 'The order the customer works through.'
        }
      >
        <ul className="flex flex-col divide-y rounded-md border">
          {form.steps.map((step, index) => {
            const required = REQUIRED_STEPS.includes(step);
            return (
              <li key={step} className="flex items-center gap-2 px-2 py-2">
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${CHECKOUT_STEP_LABELS[step]} up`}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5 disabled:opacity-30"
                  >
                    <ChevronUpIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === form.steps.length - 1}
                    aria-label={`Move ${CHECKOUT_STEP_LABELS[step]} down`}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5 disabled:opacity-30"
                  >
                    <ChevronDownIcon className="size-4" />
                  </button>
                </span>

                <span className="text-muted-foreground tabular w-5 shrink-0 text-xs">
                  {index + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{CHECKOUT_STEP_LABELS[step]}</span>
                  <span className="text-muted-foreground block text-xs">
                    {CHECKOUT_STEP_HINTS[step]}
                  </span>
                </span>

                {required ? (
                  /* An order needs somewhere to go and a way to be paid for.
                     The server refuses these too — this is just the honest UI. */
                  <span className="text-muted-foreground shrink-0 text-xs">Always on</span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => set('steps', form.steps.filter((s) => s !== step))}
                  >
                    Remove
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        {missing.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">Not in use:</span>
            {missing.map((step) => (
              <Button
                key={step}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set('steps', [...form.steps, step] as CheckoutStep[])}
              >
                Add {CHECKOUT_STEP_LABELS[step].toLowerCase()}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <Card title="Rules">
        <Toggle
          label="Let people order without an account"
          hint="A phone number and an address is all it takes."
          checked={form.guestCheckoutEnabled}
          onChange={(v) => set('guestCheckoutEnabled', v)}
        />
        <Toggle
          label="Verify the phone number with an OTP"
          hint="Cuts down fake orders. Needs an SMS provider, which is not connected yet."
          checked={form.otpRequired}
          onChange={(v) => set('otpRequired', v)}
        />
        <Toggle
          label="Fill in the city and state from the pincode"
          hint="Saves two fields on a phone keyboard."
          checked={form.addressAutofillFromPincode}
          onChange={(v) => set('addressAutofillFromPincode', v)}
        />
        <Toggle
          label="Enforce the minimum order value"
          hint="Set under Settings, Orders and pricing."
          checked={form.minimumOrderEnforced}
          onChange={(v) => set('minimumOrderEnforced', v)}
        />

        {!form.guestCheckoutEnabled && !form.otpRequired && (
          <p className="rounded-md bg-[var(--critical-bg)] px-3 py-2 text-xs text-[var(--critical-fg)]">
            {/* Caught server-side too, but saying it here saves a round trip
                to be told a checkout nobody can complete was rejected. */}
            With guest checkout off and no OTP, there is no way for anybody to
            order at all.
          </p>
        )}
      </Card>

      <SaveBar error={formError} isSaving={isSaving} onSave={save} label="Save flow" />
    </div>
  );
}
