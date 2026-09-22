'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { formatINR, quoteCashback, type WalletRules } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { saveWalletRules } from '@/app/(dashboard)/wallet-cashback/actions';

/*
 * Numbers are held as strings while being typed, so "1." and "" survive a
 * keystroke. The server parses and validates them — this form never decides
 * what is a valid rule.
 */
type SlabForm = { minOrderValue: string; percent: string; maxAmount: string };
type FormState = {
  enabled: boolean;
  signupBonus: { enabled: boolean; amount: string; validityDays: string };
  cashback: { enabled: boolean; holdHours: string; validityDays: string; slabs: SlabForm[] };
  redemption: {
    enabled: boolean;
    minOrderValue: string;
    maxPercentOfOrder: string;
    maxAmountPerOrder: string;
  };
  adminCreditValidityDays: string;
};

const days = (value: number | null) => (value === null ? '' : String(value));

function toForm(rules: WalletRules): FormState {
  return {
    enabled: rules.enabled,
    signupBonus: {
      enabled: rules.signupBonus.enabled,
      amount: rules.signupBonus.amount,
      validityDays: days(rules.signupBonus.validityDays),
    },
    cashback: {
      enabled: rules.cashback.enabled,
      holdHours: String(rules.cashback.holdHours),
      validityDays: days(rules.cashback.validityDays),
      slabs: rules.cashback.slabs.map((slab) => ({
        minOrderValue: slab.minOrderValue,
        percent: String(slab.percent),
        maxAmount: slab.maxAmount ?? '',
      })),
    },
    redemption: {
      enabled: rules.redemption.enabled,
      minOrderValue: rules.redemption.minOrderValue,
      maxPercentOfOrder: String(rules.redemption.maxPercentOfOrder),
      maxAmountPerOrder: rules.redemption.maxAmountPerOrder ?? '',
    },
    adminCreditValidityDays: days(rules.adminCreditValidityDays),
  };
}

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

function Section({
  title,
  subtitle,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`${title} on or off`} />
      </div>
      {/* Kept editable while off, so the owner can set a rule up before
          switching it on. */}
      <div className={enabled ? 'flex flex-col gap-4' : 'flex flex-col gap-4 opacity-60'}>
        {children}
      </div>
    </section>
  );
}

/**
 * The wallet and cashback rules.
 *
 * Every rule applies from the next event on — the next sign-up, the next order,
 * the next credit. Orders already placed keep the cashback they were promised
 * and credit already granted keeps its expiry, which is what the note under the
 * save button tells the owner.
 */
export function WalletSettingsForm({ initial }: { initial: WalletRules }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  const patch = <K extends keyof FormState>(key: K, value: Partial<FormState[K]>) =>
    setForm((current) => ({
      ...current,
      [key]: typeof current[key] === 'object' ? { ...(current[key] as object), ...value } : value,
    }));

  const setSlab = (index: number, value: Partial<SlabForm>) =>
    setForm((current) => ({
      ...current,
      cashback: {
        ...current.cashback,
        slabs: current.cashback.slabs.map((slab, i) => (i === index ? { ...slab, ...value } : slab)),
      },
    }));

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveWalletRules(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Wallet rules saved');
      router.refresh();
    });
  }

  /*
   * A worked example under the slabs, from the rules as typed: the owner sees
   * what a ₹425 bag of cement and a ₹60,000 site order would earn before
   * saving, with the same function the storefront and the order write use.
   */
  const preview = previewRules(form);
  const examples = ['425.00', '5000.00', '60000.00'].map((base) => ({
    base,
    quote: preview ? quoteCashback({ base }, preview) : null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card flex items-center justify-between gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">Wallet</h2>
          <p className="text-muted-foreground text-xs">
            The master switch. Off hides the wallet on the storefront and stops every rule below.
            Balances customers already hold are kept.
          </p>
        </div>
        <Switch
          checked={form.enabled}
          onCheckedChange={(value) => setForm((c) => ({ ...c, enabled: value }))}
          aria-label="Wallet on or off"
        />
      </section>

      <Section
        title="Signup bonus"
        subtitle="Credited once, on a new customer's first sign-in. Customers who had an account before the wallet launched do not get it."
        enabled={form.signupBonus.enabled}
        onToggle={(value) => patch('signupBonus', { enabled: value })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount" htmlFor="bonus-amount" error={errors['signupBonus.amount']}>
            <Input
              id="bonus-amount"
              value={form.signupBonus.amount}
              onChange={(e) => patch('signupBonus', { amount: e.target.value })}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
          <Field
            label="Valid for (days)"
            htmlFor="bonus-days"
            error={errors['signupBonus.validityDays']}
            hint="Blank means it never expires."
          >
            <Input
              id="bonus-days"
              value={form.signupBonus.validityDays}
              onChange={(e) => patch('signupBonus', { validityDays: e.target.value.replace(/\D/g, '') })}
              inputMode="numeric"
              className="tabular"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Cashback"
        subtitle="Earned on the goods value after coupons (not delivery or added GST), and not on the part paid from the wallet. The highest slab an order reaches applies."
        enabled={form.cashback.enabled}
        onToggle={(value) => patch('cashback', { enabled: value })}
      >
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-medium">
            <span>Order value from</span>
            <span>Cashback %</span>
            <span>Max per order</span>
            <span className="w-8" />
          </div>
          {form.cashback.slabs.map((slab, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                <Input
                  aria-label={`Slab ${i + 1} order value`}
                  value={slab.minOrderValue}
                  onChange={(e) => setSlab(i, { minOrderValue: e.target.value })}
                  inputMode="decimal"
                  className="tabular"
                  placeholder="100"
                />
                <Input
                  aria-label={`Slab ${i + 1} percent`}
                  value={slab.percent}
                  onChange={(e) => setSlab(i, { percent: e.target.value })}
                  inputMode="decimal"
                  className="tabular"
                  placeholder="1"
                />
                <Input
                  aria-label={`Slab ${i + 1} maximum`}
                  value={slab.maxAmount}
                  onChange={(e) => setSlab(i, { maxAmount: e.target.value })}
                  inputMode="decimal"
                  className="tabular"
                  placeholder="No cap"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove slab ${i + 1}`}
                  onClick={() =>
                    setForm((c) => ({
                      ...c,
                      cashback: { ...c.cashback, slabs: c.cashback.slabs.filter((_, j) => j !== i) },
                    }))
                  }
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
              {(['minOrderValue', 'percent', 'maxAmount'] as const).map((field) => {
                const message = errors[`cashback.slabs.${i}.${field}`];
                return message ? (
                  <span key={field} className="text-xs text-[var(--critical-fg)]">
                    {message}
                  </span>
                ) : null;
              })}
            </div>
          ))}
          {errors['cashback.slabs'] && (
            <span className="text-xs text-[var(--critical-fg)]">{errors['cashback.slabs']}</span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setForm((c) => ({
                ...c,
                cashback: {
                  ...c.cashback,
                  slabs: [...c.cashback.slabs, { minOrderValue: '', percent: '', maxAmount: '' }],
                },
              }))
            }
          >
            <PlusIcon className="size-4" />
            Add slab
          </Button>
        </div>

        {preview && (
          <p className="text-muted-foreground rounded-md bg-muted px-3 py-2 text-xs">
            {examples.map(({ base, quote }, i) => (
              <span key={base}>
                {i > 0 && ' · '}
                {formatINR(base)} order earns{' '}
                <span className="text-foreground tabular font-medium">
                  {quote ? `${formatINR(quote.amount)} (${quote.percent}%)` : 'nothing'}
                </span>
              </span>
            ))}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Credit after delivery (hours)"
            htmlFor="hold-hours"
            error={errors['cashback.holdHours']}
            hint="Held back this long after an order is marked delivered. 0 credits at once."
          >
            <Input
              id="hold-hours"
              value={form.cashback.holdHours}
              onChange={(e) => patch('cashback', { holdHours: e.target.value.replace(/\D/g, '') })}
              inputMode="numeric"
              className="tabular"
            />
          </Field>
          <Field
            label="Valid for (days)"
            htmlFor="cashback-days"
            error={errors['cashback.validityDays']}
            hint="Counted from when it lands. Blank means it never expires."
          >
            <Input
              id="cashback-days"
              value={form.cashback.validityDays}
              onChange={(e) => patch('cashback', { validityDays: e.target.value.replace(/\D/g, '') })}
              inputMode="numeric"
              className="tabular"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Paying with the wallet"
        subtitle="How much of an order a customer may pay from their balance at checkout."
        enabled={form.redemption.enabled}
        onToggle={(value) => patch('redemption', { enabled: value })}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Orders above"
            htmlFor="redeem-min"
            error={errors['redemption.minOrderValue']}
            hint="Order total, including delivery."
          >
            <Input
              id="redeem-min"
              value={form.redemption.minOrderValue}
              onChange={(e) => patch('redemption', { minOrderValue: e.target.value })}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
          <Field
            label="Up to % of the order"
            htmlFor="redeem-percent"
            error={errors['redemption.maxPercentOfOrder']}
          >
            <Input
              id="redeem-percent"
              value={form.redemption.maxPercentOfOrder}
              onChange={(e) => patch('redemption', { maxPercentOfOrder: e.target.value })}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
          <Field
            label="Cap per order"
            htmlFor="redeem-cap"
            error={errors['redemption.maxAmountPerOrder']}
            hint="Blank means no cap."
          >
            <Input
              id="redeem-cap"
              value={form.redemption.maxAmountPerOrder}
              onChange={(e) => patch('redemption', { maxAmountPerOrder: e.target.value })}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
        </div>
      </Section>

      <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">Manual credit</h2>
          <p className="text-muted-foreground text-xs">
            The default validity when you add credit to a customer by hand. You can override it
            each time.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Valid for (days)"
            htmlFor="admin-days"
            error={errors.adminCreditValidityDays}
            hint="Blank means it never expires."
          >
            <Input
              id="admin-days"
              value={form.adminCreditValidityDays}
              onChange={(e) =>
                setForm((c) => ({ ...c, adminCreditValidityDays: e.target.value.replace(/\D/g, '') }))
              }
              inputMode="numeric"
              className="tabular"
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-col gap-1">
        <Button type="button" className="self-start" disabled={isSaving} onClick={save}>
          {isSaving ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
          Save wallet rules
        </Button>
        <p className="text-muted-foreground text-xs">
          Changes apply from now on. Orders already placed keep the cashback they were promised,
          and credit already given keeps its expiry date.
        </p>
      </div>
    </div>
  );
}

/** The typed slabs as rules, or null while any of them is not a number yet. */
function previewRules(form: FormState) {
  const slabs = [];
  for (const slab of form.cashback.slabs) {
    const min = Number(slab.minOrderValue);
    const percent = Number(slab.percent);
    const max = slab.maxAmount.trim() === '' ? null : Number(slab.maxAmount);
    if (!Number.isFinite(min) || min < 0 || !Number.isFinite(percent) || percent < 0) return null;
    if (max !== null && (!Number.isFinite(max) || max < 0)) return null;
    slabs.push({
      minOrderValue: min.toFixed(2),
      percent,
      maxAmount: max === null ? null : max.toFixed(2),
    });
  }
  slabs.sort((a, b) => Number(a.minOrderValue) - Number(b.minOrderValue));
  return { enabled: form.enabled, cashback: { enabled: form.cashback.enabled, slabs } };
}
