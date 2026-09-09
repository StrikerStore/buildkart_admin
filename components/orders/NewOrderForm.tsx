'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2Icon,
  LoaderCircleIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  TriangleAlertIcon,
  UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  canFulfil,
  defaultInstrumentFor,
  formatINR,
  gatewaysForMethod,
  priceOrder,
  referenceLabelFor,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentGateway,
  type PaymentMethod,
} from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createOrder,
  lookupCustomer,
  lookupPincode,
  searchVariants,
  type CustomerLookupResult,
  type VariantSearchResult,
} from '@/app/(dashboard)/orders/new/actions';
import { cn } from '@/lib/utils';

type Line = { variant: VariantSearchResult; quantity: number; override: string };

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <span className="text-xs text-[var(--critical-fg)]">{error}</span>}
    </div>
  );
}

export function NewOrderForm({ bulkCutoff }: { bulkCutoff: string }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // --- customer ------------------------------------------------------------
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [known, setKnown] = useState<CustomerLookupResult | null>(null);

  // --- address -------------------------------------------------------------
  const [address, setAddress] = useState({
    line1: '',
    line2: '',
    landmark: '',
    city: '',
    state: 'Madhya Pradesh',
    pincode: '',
  });
  const [saveAddress, setSaveAddress] = useState(true);
  const [areaNote, setAreaNote] = useState<string | null>(null);

  // --- items ---------------------------------------------------------------
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<VariantSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // --- money ---------------------------------------------------------------
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [discountTotal, setDiscountTotal] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [freeAbove, setFreeAbove] = useState<string | null>(null);

  // --- the rest ------------------------------------------------------------
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [takePayment, setTakePayment] = useState(false);
  const [gateway, setGateway] = useState<PaymentGateway>('CASH');
  const [reference, setReference] = useState('');
  const [confirmNow, setConfirmNow] = useState(true);
  const [customerNote, setCustomerNote] = useState('');
  const [internalNote, setInternalNote] = useState('');

  /*
   * Recognising a returning customer before the order is written is what stops
   * a second account — and a split order history — from being created because
   * the name was spelled differently this time.
   */
  useEffect(() => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setKnown(null);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await lookupCustomer({ phone: digits });
      if (result.ok) {
        setKnown(result.data);
        if (result.data.found && result.data.name && name.trim() === '') setName(result.data.name);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  // Delivery terms come from the area rather than being guessed at.
  useEffect(() => {
    if (!/^\d{6}$/.test(address.pincode)) {
      setAreaNote(null);
      setFreeAbove(null);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await lookupPincode(address.pincode);
      if (!result.ok) return;
      if (result.data.serviced) {
        setAreaNote(`${result.data.areaName} · delivery ${formatINR(result.data.deliveryCharge)}`);
        setFreeAbove(result.data.freeAbove);
        if (deliveryCharge === '') setDeliveryCharge(result.data.deliveryCharge);
        if (address.city === '') setAddress((a) => ({ ...a, city: 'Indore' }));
      } else {
        setAreaNote('Not a listed delivery area — the order can still be taken.');
        setFreeAbove(null);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address.pincode]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await searchVariants({ q: search, limit: 20 });
      setSearching(false);
      if (result.ok) setResults(result.data.results);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  /*
   * Priced with the very same function the server uses, so the total on screen
   * is the total that will be charged. The server still recomputes it from the
   * catalogue — this is a preview, never the source of the figure.
   */
  const preview = useMemo(() => {
    if (lines.length === 0) return null;
    try {
      return priceOrder(
        lines.map((line) => ({
          variantId: line.variant.variantId,
          quantity: line.quantity,
          unitPriceOverride: line.override.trim() === '' ? undefined : line.override.trim(),
        })),
        lines.map((line) => ({
          variantId: line.variant.variantId,
          price: line.variant.price,
          bulkPrice: line.variant.bulkPrice,
          // Carried through from the variant search. Without these the preview
          // would silently disagree with the server for any exclusive-priced
          // product — the exact divergence sharing `priceOrder` prevents.
          taxPercent: line.variant.taxPercent,
          taxInclusive: line.variant.taxInclusive,
          taxable: line.variant.taxable,
        })),
        {
          bulkCutoff,
          deliveryCharge: deliveryCharge.trim() === '' ? '0.00' : deliveryCharge.trim(),
          discountTotal: discountTotal.trim() === '' ? undefined : discountTotal.trim(),
          freeDeliveryAbove: freeAbove,
        },
      );
    } catch {
      // A half-typed price is not an error worth shouting about; the summary
      // simply waits until the numbers make sense again.
      return null;
    }
  }, [lines, deliveryCharge, discountTotal, bulkCutoff, freeAbove]);

  function addLine(variant: VariantSearchResult) {
    setLines((current) => {
      const existing = current.find((line) => line.variant.variantId === variant.variantId);
      if (existing) {
        return current.map((line) =>
          line.variant.variantId === variant.variantId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [...current, { variant, quantity: 1, override: '' }];
    });
    setSearch('');
  }

  function submit() {
    setFieldErrors({});
    setFormError(null);

    startSaving(async () => {
      const result = await createOrder({
        customer: { phone, name },
        address,
        saveAddress,
        lines: lines.map((line) => ({
          variantId: line.variant.variantId,
          quantity: line.quantity,
          unitPriceOverride: line.override.trim(),
        })),
        deliveryCharge,
        discountTotal,
        discountCode,
        paymentMethod,
        payment: takePayment
          ? {
              gateway,
              instrument: defaultInstrumentFor(gateway) ?? undefined,
              reference,
            }
          : undefined,
        status: confirmNow ? 'CONFIRMED' : 'PLACED',
        customerNote,
        internalNote,
      });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }

      toast.success(`${result.data.orderNumber} created — ${formatINR(result.data.grandTotal)}`);
      router.push(`/orders/${result.data.orderId}`);
    });
  }

  const canSubmit = lines.length > 0 && phone.trim() !== '' && address.line1.trim() !== '';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        {formError && (
          <div className="flex items-start gap-2 rounded-lg bg-[var(--critical-bg)] px-4 py-3 text-[var(--critical-fg)]">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <Card title="Items" subtitle="Search by product name or SKU.">
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cement, sariya, 8mm…"
              className="pl-8"
            />
          </div>

          {search.trim() !== '' && (
            <ul className="max-h-[260px] overflow-y-auto rounded-md border">
              {searching && results.length === 0 && (
                <li className="text-muted-foreground px-3 py-2 text-xs">Searching…</li>
              )}
              {!searching && results.length === 0 && (
                <li className="text-muted-foreground px-3 py-2 text-xs">Nothing matches.</li>
              )}
              {results.map((variant) => {
                const out = variant.inventoryTracked && variant.stockQty <= 0;
                return (
                  <li key={variant.variantId} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => addLine(variant)}
                      className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{variant.nameEn}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {[variant.optionLabel, variant.sku].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'tabular shrink-0 text-xs',
                          out ? 'text-[var(--critical-fg)]' : 'text-muted-foreground',
                        )}
                      >
                        {out ? 'Out of stock' : `${variant.stockQty} left`}
                      </span>
                      <span className="tabular shrink-0 font-medium">
                        {formatINR(variant.price)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {lines.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
              No items yet. Search above to add the first one.
            </p>
          ) : (
            <ul className="flex flex-col">
              {lines.map((line, index) => {
                const priced = preview?.lines[index];
                const short = !canFulfil(
                  {
                    stockQty: line.variant.stockQty,
                    inventoryTracked: line.variant.inventoryTracked,
                    inventoryPolicy: line.variant.inventoryPolicy,
                  },
                  line.quantity,
                );

                return (
                  <li
                    key={line.variant.variantId}
                    className="flex flex-wrap items-center gap-2 border-b py-2.5 last:border-b-0"
                  >
                    <span className="min-w-[180px] flex-1">
                      <span className="block truncate font-medium">{line.variant.nameEn}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {[line.variant.optionLabel, line.variant.sku].filter(Boolean).join(' · ')}
                        {line.variant.unitLabel && ` · ${line.variant.unitLabel}`}
                      </span>
                      {short && (
                        <span className="block text-xs text-[var(--critical-fg)]">
                          Only {line.variant.stockQty} in stock
                        </span>
                      )}
                    </span>

                    <Input
                      value={String(line.quantity)}
                      onChange={(e) => {
                        const next = Number(e.target.value.replace(/\D/g, '')) || 1;
                        setLines((current) =>
                          current.map((l, i) => (i === index ? { ...l, quantity: next } : l)),
                        );
                      }}
                      inputMode="numeric"
                      className="tabular w-[72px] text-right"
                      aria-label="Quantity"
                    />

                    <Input
                      value={line.override}
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((l, i) => (i === index ? { ...l, override: e.target.value } : l)),
                        )
                      }
                      // Never type="number": Android keyboards drop the decimal
                      // separator, and the target user is on a budget phone.
                      inputMode="decimal"
                      placeholder={priced?.unitPrice ?? line.variant.price}
                      className="tabular w-[96px] text-right"
                      aria-label="Rate"
                    />

                    <span className="tabular w-[92px] shrink-0 text-right font-medium">
                      {priced ? formatINR(priced.lineTotal) : '—'}
                      {priced?.wasBulkPrice && (
                        <span className="text-muted-foreground block text-[11px] font-normal">
                          bulk rate
                        </span>
                      )}
                      {priced?.wasOverridden && (
                        <span className="text-muted-foreground block text-[11px] font-normal">
                          your rate
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => setLines((c) => c.filter((_, i) => i !== index))}
                      className="text-muted-foreground hover:text-[var(--critical-fg)] shrink-0 transition-colors"
                      aria-label="Remove item"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Customer" subtitle="The phone number is how a customer is recognised.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone" error={fieldErrors['customer.phone']}>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="98260 11001"
                className="tabular"
              />
            </Field>
            <Field label="Name" htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rajesh Verma"
              />
            </Field>
          </div>

          {known?.found && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-md px-3 py-2 text-xs',
                known.isBlocked
                  ? 'bg-[var(--critical-bg)] text-[var(--critical-fg)]'
                  : 'bg-[var(--info-bg)] text-[var(--info-fg)]',
              )}
            >
              <UserIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {known.isBlocked
                  ? 'This customer is blocked. Unblock them before placing an order.'
                  : `Existing customer · ${known.totalOrders} order${known.totalOrders === 1 ? '' : 's'} so far.`}
                {known.addresses.length > 0 && !known.isBlocked && (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {known.addresses.map((saved) => (
                      <button
                        key={saved.id}
                        type="button"
                        onClick={() => {
                          setAddress({
                            line1: saved.line1,
                            line2: saved.line2 ?? '',
                            landmark: saved.landmark ?? '',
                            city: saved.city,
                            state: saved.state,
                            pincode: saved.pincode,
                          });
                          // Already on file; saving it again would only duplicate.
                          setSaveAddress(false);
                        }}
                        className="rounded-full bg-white/60 px-2 py-0.5 underline-offset-2 hover:underline"
                      >
                        {saved.line1}, {saved.pincode}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            </div>
          )}
        </Card>

        <Card title="Delivery address">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Address"
              htmlFor="line1"
              error={fieldErrors['address.line1']}
              className="sm:col-span-2"
            >
              <Input
                id="line1"
                value={address.line1}
                onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                placeholder="Shop 12, Nehru Nagar"
              />
            </Field>
            <Field label="Landmark" htmlFor="landmark">
              <Input
                id="landmark"
                value={address.landmark}
                onChange={(e) => setAddress((a) => ({ ...a, landmark: e.target.value }))}
                placeholder="Opposite SBI"
              />
            </Field>
            <Field label="Pincode" htmlFor="pincode" error={fieldErrors['address.pincode']}>
              <Input
                id="pincode"
                value={address.pincode}
                onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))}
                inputMode="numeric"
                maxLength={6}
                className="tabular"
                placeholder="452001"
              />
            </Field>
            <Field label="City" htmlFor="city" error={fieldErrors['address.city']}>
              <Input
                id="city"
                value={address.city}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                placeholder="Indore"
              />
            </Field>
            <Field label="State" htmlFor="state" error={fieldErrors['address.state']}>
              <Input
                id="state"
                value={address.state}
                onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
              />
            </Field>
          </div>

          {areaNote && <p className="text-muted-foreground text-xs">{areaNote}</p>}

          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={saveAddress}
              onCheckedChange={(checked) => setSaveAddress(checked === true)}
            />
            Save this address to the customer for next time
          </label>
        </Card>

        <Card title="Notes">
          <Field label="Note from the customer" htmlFor="customer-note">
            <Textarea
              id="customer-note"
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              rows={2}
              placeholder="Deliver before noon, call on arrival"
            />
          </Field>
          <Field label="Internal note" htmlFor="internal-note">
            <Textarea
              id="internal-note"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={2}
              placeholder="Taken over the phone by Suresh"
            />
          </Field>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card title="Summary">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular">{preview ? formatINR(preview.subtotal) : '—'}</span>
            </div>
            {preview?.bulkPricingApplied && (
              <p className="text-xs text-[var(--success-fg)]">
                Bulk rates applied — the cart is over {formatINR(bulkCutoff)}.
              </p>
            )}

            <Field label="Discount" htmlFor="discount">
              <Input
                id="discount"
                value={discountTotal}
                onChange={(e) => setDiscountTotal(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="tabular"
              />
            </Field>
            <Field label="Discount code" htmlFor="discount-code">
              <Input
                id="discount-code"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Delivery charge" htmlFor="delivery">
              <Input
                id="delivery"
                value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="tabular"
              />
            </Field>

            {/* Only the added tax is its own line — tax already inside the
                prices is part of the subtotal above and is reported after the
                total instead, so nothing is counted twice. */}
            {preview && preview.taxAddedTotal !== '0.00' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST</span>
                <span className="tabular">{formatINR(preview.taxAddedTotal)}</span>
              </div>
            )}

            <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular">{preview ? formatINR(preview.grandTotal) : '—'}</span>
            </div>

            {preview && preview.taxAddedTotal === '0.00' && preview.taxTotal !== '0.00' && (
              <p className="text-muted-foreground text-xs">
                Includes {formatINR(preview.taxTotal)} GST.
              </p>
            )}
          </div>
        </Card>

        <Card title="Payment">
          <Field label="Method">
            <Select
              value={paymentMethod}
              onValueChange={(value) => {
                const method = value as PaymentMethod;
                setPaymentMethod(method);
                setGateway(gatewaysForMethod(method)[0]!);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <label className="flex items-start gap-2.5">
            <Checkbox
              checked={takePayment}
              onCheckedChange={(checked) => setTakePayment(checked === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Payment already received</span>
              <span className="text-muted-foreground text-xs">
                {/* A counter sale is usually paid on the spot, so recording it
                    here saves it becoming a second job someone must remember. */}
                Records the full {preview ? formatINR(preview.grandTotal) : 'amount'} against this
                order.
              </span>
            </span>
          </label>

          {takePayment && (
            <>
              <Field label="Through">
                <Select value={gateway} onValueChange={(value) => setGateway(value as PaymentGateway)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gatewaysForMethod(paymentMethod).map((value) => (
                      <SelectItem key={value} value={value}>
                        {PAYMENT_GATEWAY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={referenceLabelFor(gateway)} htmlFor="payment-ref">
                <Input
                  id="payment-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="font-mono"
                />
              </Field>
            </>
          )}
        </Card>

        <Card title="Create">
          <label className="flex items-start gap-2.5">
            <Checkbox
              checked={confirmNow}
              onCheckedChange={(checked) => setConfirmNow(checked === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Confirm straight away</span>
              <span className="text-muted-foreground text-xs">
                An order taken by phone has already been accepted, so it starts confirmed.
              </span>
            </span>
          </label>

          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" />
            Stock comes off the shelf as soon as the order is created, exactly as it would for a
            storefront order.
          </p>

          <Button type="button" disabled={!canSubmit || isSaving} onClick={submit} className="w-full">
            {isSaving ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            Create order{preview ? ` · ${formatINR(preview.grandTotal)}` : ''}
          </Button>
        </Card>
      </div>
    </div>
  );
}
