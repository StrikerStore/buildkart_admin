import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  formatINR,
  formatStoreDate,
  formatStoreDateTime,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  totalPayments,
  type OrderDetailDto,
  type SettingValue,
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
  return { title: orderNumber ? `${orderNumber} delivery challan` : 'Delivery challan' };
}

type Copy = 'SHOP' | 'CUSTOMER';

const COPY_LABELS: Record<Copy, string> = {
  SHOP: 'Shop copy — return signed',
  CUSTOMER: 'Customer copy',
};

/**
 * The delivery challan.
 *
 * Travels with the goods: the driver hands the load over against it, the
 * person receiving counts what arrived and signs, and the signed copy comes
 * back to the shop as the record that the order was delivered — whole, or
 * short, in which case the "received" column says by how much.
 *
 * No prices on the lines. A challan proves goods moved, not what they cost, and
 * it is usually signed by a site supervisor rather than the buyer. The one
 * figure on it is what the driver must collect, because that is the driver's
 * business.
 *
 * `?copies=2` adds a customer copy on a second page.
 */
export default async function ChallanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string }>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const client = await api();

  const [order, settings] = await Promise.all([
    client.orders.detail.query({ id }),
    client.content.settings.query(),
  ]);
  if (!order) notFound();

  const copies: Copy[] = query.copies === '2' ? ['SHOP', 'CUSTOMER'] : ['SHOP'];
  const cancelled = order.status === 'CANCELLED';

  return (
    <>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .challan + .challan { break-before: page; }
        }
      `}</style>

      <div className="mx-auto flex max-w-[820px] flex-col gap-6 p-6 print:p-0">
        <div className="no-print flex flex-col gap-2 rounded-lg border bg-neutral-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-neutral-600">
              The driver gets this signed on delivery and brings the shop copy back.
            </p>
            <div className="flex items-center gap-3">
              {copies.length === 1 ? (
                <a href={`/orders/${order.id}/challan?copies=2`} className="underline">
                  Add a customer copy
                </a>
              ) : (
                <a href={`/orders/${order.id}/challan`} className="underline">
                  Shop copy only
                </a>
              )}
              <PrintButton />
            </div>
          </div>
          {cancelled && (
            <p className="font-medium text-red-700">
              This order is cancelled. Do not send goods against this challan.
            </p>
          )}
        </div>

        {copies.map((copy) => (
          <Challan key={copy} order={order} store={settings.store} copy={copy} />
        ))}
      </div>
    </>
  );
}

function Challan({
  order,
  store,
  copy,
}: {
  order: OrderDetailDto;
  store: SettingValue<'store.profile'>;
  copy: Copy;
}) {
  const { address } = order;
  const receiverName = address.name || order.customer.name || 'Customer';
  const receiverPhone = address.phone || order.customer.phone;
  // The account holder, when someone else is taking the delivery on site.
  const orderedBySomeoneElse = Boolean(address.phone) && address.phone !== order.customer.phone;
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

  // What is left to collect at the door, not the order total: part of it may
  // already have been paid online or from store credit.
  const { outstanding } = totalPayments(order.transactions, order.grandTotal);
  const alreadyPaid = outstanding !== order.grandTotal;

  const pin =
    address.latitude != null && address.longitude != null
      ? `${address.latitude.toFixed(6)}, ${address.longitude.toFixed(6)}`
      : null;

  return (
    <article className="challan flex flex-col gap-5 text-[13px] leading-snug">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div className="flex flex-col gap-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt=""
            width={318}
            height={96}
            className="mb-1.5 h-9 w-auto self-start"
          />
          <span className="text-lg font-bold">{store.nameEn || 'BuildKart'}</span>
          {store.addressLines.map((line, index) => (
            <span key={index} className="text-neutral-700">
              {line}
            </span>
          ))}
          {store.supportPhone && <span className="text-neutral-700">{store.supportPhone}</span>}
          {store.gstin && <span className="text-neutral-700">GSTIN {store.gstin}</span>}
        </div>

        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-xl font-bold tracking-wide">DELIVERY CHALLAN</span>
          <span className="text-neutral-700">डिलीवरी चालान</span>
          <span className="mt-1 rounded border border-black px-2 py-0.5 text-[11px] font-semibold uppercase">
            {COPY_LABELS[copy]}
          </span>
          <span className="mt-1">
            Challan no. <span className="font-bold">{order.orderNumber}</span>
          </span>
          <span className="text-neutral-700">Order date {formatStoreDate(order.placedAt)}</span>
          <span className="text-neutral-700">
            {order.status === 'CANCELLED' ? 'CANCELLED' : ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="mb-1 font-semibold uppercase tracking-wide text-neutral-600">
            Deliver to / प्राप्तकर्ता
          </h2>
          <span className="text-[15px] font-bold">{receiverName}</span>
          <span className="font-semibold">{receiverPhone}</span>
          <span>{address.line1}</span>
          {address.line2 && <span>{address.line2}</span>}
          {address.landmark && <span>Near {address.landmark}</span>}
          <span>
            {address.city}
            {address.state && `, ${address.state}`} {address.pincode}
          </span>
          {pin && (
            <span className="mt-1 text-neutral-700">
              Map pin {pin}
              <span className="block break-all text-[11px]">
                maps.google.com/?q={address.latitude},{address.longitude}
              </span>
            </span>
          )}
          {orderedBySomeoneElse && (
            <span className="mt-1 text-neutral-700">
              Ordered by {order.customer.name || 'customer'} · {order.customer.phone}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="font-semibold uppercase tracking-wide text-neutral-600">
            Dispatch / भेजने का विवरण
          </h2>
          {order.expectedDeliveryAt && (
            <Line label="Expected delivery" value={formatStoreDateTime(order.expectedDeliveryAt)} />
          )}
          {order.unloadingCharge !== '0.00' && (
            <Line label="Unloading" value="Included — unload at site" strong />
          )}
          <Line label="Vehicle no." />
          <Line label="Driver name" />
          <Line label="Driver phone" />
        </div>
      </section>

      <table className="w-full border-collapse border border-black">
        <thead>
          <tr className="bg-neutral-100 text-left">
            <th className="w-[36px] border border-black px-2 py-1.5 font-semibold">#</th>
            <th className="border border-black px-2 py-1.5 font-semibold">Item / सामान</th>
            <th className="w-[80px] border border-black px-2 py-1.5 font-semibold">Unit</th>
            <th className="w-[70px] border border-black px-2 py-1.5 text-right font-semibold">
              Qty sent
            </th>
            <th className="w-[84px] border border-black px-2 py-1.5 text-right font-semibold">
              Qty received
            </th>
            <th className="w-[120px] border border-black px-2 py-1.5 font-semibold">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => {
            const detail = [item.snapshot.optionValues.join(' / '), item.snapshot.sku]
              .filter(Boolean)
              .join(' · ');
            return (
              <tr key={item.id} className="align-top">
                <td className="border border-black px-2 py-1.5">{index + 1}</td>
                <td className="border border-black px-2 py-1.5">
                  <span className="block font-medium">{item.snapshot.nameEn}</span>
                  {/* The person signing on site may not read the English name. */}
                  {item.snapshot.nameHi && (
                    <span className="block text-neutral-700">{item.snapshot.nameHi}</span>
                  )}
                  {detail && <span className="block text-neutral-600">{detail}</span>}
                </td>
                <td className="border border-black px-2 py-1.5">
                  {item.snapshot.unitLabelEn ?? ''}
                </td>
                <td className="tabular border border-black px-2 py-1.5 text-right font-semibold">
                  {item.quantity}
                </td>
                {/* Left blank on purpose: filled in by hand on delivery. */}
                <td className="border border-black px-2 py-1.5" />
                <td className="border border-black px-2 py-1.5" />
              </tr>
            );
          })}
          <tr>
            <td className="border border-black px-2 py-1.5" />
            <td className="border border-black px-2 py-1.5 font-semibold" colSpan={2}>
              Total ({order.items.length} item{order.items.length === 1 ? '' : 's'})
            </td>
            <td className="tabular border border-black px-2 py-1.5 text-right font-bold">
              {totalUnits}
            </td>
            <td className="border border-black px-2 py-1.5" />
            <td className="border border-black px-2 py-1.5" />
          </tr>
        </tbody>
      </table>

      <section className="rounded border-2 border-black px-3 py-2">
        {outstanding !== '0.00' ? (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[15px] font-bold">
              Collect {formatINR(outstanding)} on delivery
              <span className="ml-2 font-normal text-neutral-700">
                ({PAYMENT_METHOD_LABELS[order.paymentMethod]})
              </span>
            </span>
            {alreadyPaid && (
              <span className="text-neutral-700">
                Order total {formatINR(order.grandTotal)}, the rest already paid
              </span>
            )}
          </div>
        ) : (
          <span className="text-[15px] font-bold">Paid in full — nothing to collect</span>
        )}
      </section>

      {order.customerNote && (
        <section className="flex flex-col gap-0.5">
          <h2 className="font-semibold">Note from the customer</h2>
          <p className="whitespace-pre-wrap">{order.customerNote}</p>
        </section>
      )}

      <section className="flex flex-col gap-1 border-t pt-3">
        <p>
          I have received the goods listed above in good condition and in the quantity written in
          the &ldquo;Qty received&rdquo; column.
        </p>
        <p className="text-neutral-700">
          मैंने ऊपर लिखा सामान सही हालत में और &ldquo;Qty received&rdquo; में लिखी मात्रा में
          प्राप्त किया है।
        </p>
      </section>

      <section className="grid grid-cols-3 gap-6 pt-8">
        <Signature label="Receiver's signature" sub="प्राप्तकर्ता के हस्ताक्षर" />
        <Signature label="Receiver's name & phone" sub="नाम और फ़ोन" />
        <Signature label="Date & time received" sub="दिनांक और समय" />
      </section>

      <section className="grid grid-cols-3 gap-6 pt-6">
        <Signature label="Driver's signature" sub="ड्राइवर के हस्ताक्षर" />
        <div />
        <Signature label={`For ${store.nameEn || 'BuildKart'}`} sub="Authorised signatory" />
      </section>

      <footer className="border-t pt-2 text-[11px] text-neutral-600">
        Short or damaged goods must be written on this challan before signing.
        {store.supportPhone ? ` Questions: ${store.supportPhone}.` : ''}
      </footer>
    </article>
  );
}

/** A labelled line — printed value, or a rule to write on. */
function Line({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  return (
    <div className="flex items-end gap-2">
      <span className="w-[120px] shrink-0 text-neutral-700">{label}</span>
      {value ? (
        <span className={strong ? 'font-bold' : 'font-medium'}>{value}</span>
      ) : (
        <span className="h-5 flex-1 border-b border-neutral-500" />
      )}
    </div>
  );
}

/** Room to sign above a rule, with what goes there underneath. */
function Signature({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex flex-col">
      <span className="h-12 border-b border-black" />
      <span className="mt-1 font-medium">{label}</span>
      <span className="text-[11px] text-neutral-600">{sub}</span>
    </div>
  );
}
