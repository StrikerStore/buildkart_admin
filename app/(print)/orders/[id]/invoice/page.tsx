import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  formatINR,
  splitGst,
  formatStoreDateTime,
  ORDER_STATUS_LABELS,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_INSTRUMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  totalPayments,
} from '@StrikerStore/contract';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { api } from '@/lib/api/server';
import { PrintButton } from '@/components/orders/PrintButton';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const orderNumber = await (await api()).orders.orderNumber.query({ id });
  return { title: orderNumber ? `${orderNumber} slip` : 'Order slip' };
}

/**
 * The order slip.
 *
 * One page, printed and sent with the rider. Everything on it comes from the
 * order's own snapshots rather than the live catalogue, so a slip reprinted
 * weeks later still shows what was actually bought at the price it was bought
 * for — even if the product has since been renamed, repriced or archived.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const client = await api();

  const [order, settings] = await Promise.all([
    client.orders.detail.query({ id }),
    client.content.settings.query(),
  ]);

  if (!order) notFound();

  const store = settings.store;
  const { address } = order;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  // What the rider still has to collect, which is not the order total once
  // anything has already been paid online.
  const { outstanding } = totalPayments(order.transactions, order.grandTotal);

  /*
   * Whether this slip is a tax invoice at all. Every order placed before GST
   * was configured has no tax on it and prints exactly as it always did — the
   * blocks below are all gated on this.
   */
  const hasTax = order.taxTotal !== '0.00';
  const addedSplit =
    order.taxAddedTotal === '0.00' ? null : splitGst(order.taxAddedTotal, order.taxIntraState);

  return (
    <>
      {/*
       * Print rules live with the page they format. `@page` sets the sheet
       * margin — Chrome's default header and footer are turned off by the
       * user's own print dialog, not by CSS — and `print:hidden` removes the
       * on-screen toolbar so the sheet starts at the letterhead.
       */}
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="mx-auto flex max-w-[820px] flex-col gap-6 p-6 print:p-0">
        <div className="no-print flex items-center justify-between gap-3 rounded-lg border bg-neutral-50 px-4 py-3">
          <p className="text-neutral-600">
            One page, ready for the rider. Turn off headers and footers in the print dialog for a
            clean sheet.
          </p>
          <PrintButton />
        </div>

        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="flex flex-col gap-0.5">
            {/* Decorative: the legal name below is what the invoice must carry. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt=""
              width={318}
              height={96}
              className="mb-2 h-10 w-auto self-start"
            />
            <h1 className="text-xl font-bold">{store.nameEn || 'BuildKart'}</h1>
            {store.addressLines.map((line, index) => (
              <span key={index} className="text-neutral-600">
                {line}
              </span>
            ))}
            {store.supportPhone && <span className="text-neutral-600">{store.supportPhone}</span>}
            {store.gstin && <span className="text-neutral-600">GSTIN {store.gstin}</span>}
          </div>

          <div className="flex flex-col items-end gap-0.5">
            {/* Only when there is GST on it. Calling a nil-rated delivery note
                a tax invoice would be a claim the document cannot support. */}
            {hasTax && <span className="font-semibold">Tax invoice</span>}
            <span className="text-lg font-bold">{order.orderNumber}</span>
            <span className="text-neutral-600">{formatStoreDateTime(order.placedAt)}</span>
            <span className="text-neutral-600">{ORDER_STATUS_LABELS[order.status]}</span>
          </div>
        </header>

        <section className="flex flex-wrap gap-8">
          <div className="flex min-w-[220px] flex-col gap-0.5">
            <h2 className="mb-1 font-semibold">Deliver to</h2>
            <span className="font-medium">{address.name || order.customer.name || 'Customer'}</span>
            <span>{address.line1}</span>
            {address.line2 && <span>{address.line2}</span>}
            {address.landmark && <span className="text-neutral-600">Near {address.landmark}</span>}
            <span>
              {address.city}
              {address.state && `, ${address.state}`} {address.pincode}
            </span>
            <span className="mt-1">{address.phone || order.customer.phone}</span>
          </div>

          <div className="flex min-w-[200px] flex-col gap-0.5">
            <h2 className="mb-1 font-semibold">Payment</h2>
            <span>
              {order.paymentGateway
                ? PAYMENT_GATEWAY_LABELS[order.paymentGateway]
                : PAYMENT_METHOD_LABELS[order.paymentMethod]}
              {order.paymentInstrument && ` · ${PAYMENT_INSTRUMENT_LABELS[order.paymentInstrument]}`}
            </span>
            <span className="text-neutral-600">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</span>
            {order.paidAt && (
              <span className="text-neutral-600">Paid {formatStoreDateTime(order.paidAt)}</span>
            )}
            {/* The reference goes on the slip so a customer disputing a charge
                has the id in their hand without having to ring the shop. */}
            {order.paymentReference && (
              <span className="text-neutral-600">Ref {order.paymentReference}</span>
            )}
            {outstanding !== '0.00' && (
              <span className="mt-1 font-semibold">
                Collect {formatINR(outstanding)} on delivery
              </span>
            )}
          </div>
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y text-left">
              <th className="py-2 font-semibold">Item</th>
              <th className="w-[80px] py-2 text-right font-semibold">Qty</th>
              <th className="w-[110px] py-2 text-right font-semibold">Rate</th>
              {hasTax && <th className="w-[70px] py-2 text-right font-semibold">GST</th>}
              <th className="w-[110px] py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const label = [item.snapshot.optionValues.join(' / '), item.snapshot.sku]
                .filter(Boolean)
                .join(' · ');
              return (
                <tr key={item.id} className="border-b align-top">
                  <td className="py-2">
                    <span className="block font-medium">{item.snapshot.nameEn}</span>
                    {/* Hindi carries onto the slip because the person receiving
                        the goods on site may not read the English name. */}
                    {item.snapshot.nameHi && (
                      <span className="block text-neutral-600">{item.snapshot.nameHi}</span>
                    )}
                    {label && <span className="block text-neutral-600">{label}</span>}
                    {item.snapshot.hsnCode && (
                      <span className="block text-neutral-600">HSN {item.snapshot.hsnCode}</span>
                    )}
                  </td>
                  <td className="tabular py-2 text-right">
                    {item.quantity}
                    {item.snapshot.unitLabelEn && (
                      <span className="block text-neutral-600">{item.snapshot.unitLabelEn}</span>
                    )}
                  </td>
                  <td className="tabular py-2 text-right">{formatINR(item.unitPrice)}</td>
                  {hasTax && (
                    <td className="tabular py-2 text-right">
                      {/* A dash rather than "0%" for an exempt or nil-rated
                          line: the two look identical at a glance and only one
                          of them is a rate. */}
                      {item.taxPercent > 0 ? `${item.taxPercent}%` : '—'}
                    </td>
                  )}
                  <td className="tabular py-2 text-right">{formatINR(item.lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="flex w-[260px] flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-neutral-600">Subtotal ({itemCount} items)</span>
              <span className="tabular">{formatINR(order.subtotal)}</span>
            </div>
            {order.discountTotal !== '0.00' && (
              <div className="flex justify-between">
                <span className="text-neutral-600">
                  Discount{order.discountCode ? ` (${order.discountCode})` : ''}
                </span>
                <span className="tabular">− {formatINR(order.discountTotal)}</span>
              </div>
            )}
            {/*
              Derived from `taxAddedTotal`, never from the per-rate breakdown.
              
              The breakdown groups by rate, so one 18% row can contain both an
              inclusive line (tax already inside the subtotal above) and an
              exclusive one (tax genuinely added). Printing the breakdown here
              would count the inclusive half twice and this column would stop
              adding up to the total beneath it. The per-rate detail belongs in
              the summary table below, where nothing is being summed.
            */}
            {addedSplit && (
              <>
                {order.taxIntraState ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">CGST</span>
                      <span className="tabular">{formatINR(addedSplit.cgst)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">SGST</span>
                      <span className="tabular">{formatINR(addedSplit.sgst)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">IGST</span>
                    <span className="tabular">{formatINR(addedSplit.igst)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-600">Delivery</span>
              <span className="tabular">{formatINR(order.deliveryCharge)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1.5 text-base font-bold">
              <span>Total</span>
              <span className="tabular">{formatINR(order.grandTotal)}</span>
            </div>
            {/* Store credit is a way of paying, not a discount: the invoice
                total and its GST stand, and this says how part of it was paid. */}
            {order.walletApplied !== '0.00' && (
              <div className="flex justify-between">
                <span className="text-neutral-600">Paid via store credit</span>
                <span className="tabular">{formatINR(order.walletApplied)}</span>
              </div>
            )}
            {hasTax && order.taxAddedTotal === '0.00' && (
              <p className="text-neutral-600">Inclusive of {formatINR(order.taxTotal)} GST</p>
            )}
          </div>
        </div>

        {/* The per-rate summary, read back from what was frozen with the order
            rather than recomputed — a reprint has to match the copy that went
            out with the goods, even after the product moved to another rate. */}
        {order.taxBreakdown.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="font-medium">Tax summary</span>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-neutral-600">
                  <th className="py-1 font-medium">Rate</th>
                  <th className="py-1 text-right font-medium">Taxable value</th>
                  <th className="py-1 text-right font-medium">
                    {order.taxIntraState ? 'CGST' : 'IGST'}
                  </th>
                  {order.taxIntraState && <th className="py-1 text-right font-medium">SGST</th>}
                  <th className="py-1 text-right font-medium">Total tax</th>
                </tr>
              </thead>
              <tbody>
                {order.taxBreakdown.map((row) => {
                  const split = splitGst(row.taxAmount, order.taxIntraState);
                  return (
                    <tr key={row.percent} className="border-b">
                      <td className="py-1">{row.percent}%</td>
                      <td className="tabular py-1 text-right">{formatINR(row.taxableAmount)}</td>
                      <td className="tabular py-1 text-right">
                        {formatINR(order.taxIntraState ? split.cgst : split.igst)}
                      </td>
                      {order.taxIntraState && (
                        <td className="tabular py-1 text-right">{formatINR(split.sgst)}</td>
                      )}
                      <td className="tabular py-1 text-right">{formatINR(row.taxAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/*
              Says which side of the total this tax sits on, because the table
              itself cannot: the same figure means different things depending on
              whether it was inside the line prices or added to them, and a
              mixed order is both at once.
            */}
            <p className="text-neutral-600">
              {order.taxAddedTotal === '0.00'
                ? 'Included in the prices above.'
                : order.taxAddedTotal === order.taxTotal
                  ? 'Added to the total above.'
                  : `${formatINR(order.taxAddedTotal)} of this was added to the total; the rest is included in the prices above.`}
            </p>
          </div>
        )}

        {order.customerNote && (
          <section className="flex flex-col gap-1 border-t pt-3">
            <h2 className="font-semibold">Note from the customer</h2>
            <p className="whitespace-pre-wrap">{order.customerNote}</p>
          </section>
        )}

        <footer className="mt-auto flex flex-col gap-1 border-t pt-3 text-neutral-600">
          <span>
            Thank you for building with {store.nameEn || 'BuildKart'}
            {store.supportPhone ? ` · ${store.supportPhone}` : ''}
          </span>
          <span>
            Goods once delivered are checked and accepted on site. Report damage the same day.
          </span>
        </footer>
      </div>
    </>
  );
}
