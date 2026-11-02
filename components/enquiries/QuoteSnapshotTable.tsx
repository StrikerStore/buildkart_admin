import { formatINR, QUOTE_MATERIAL_LABELS, type QuoteSnapshot } from '@StrikerStore/contract';

const STATUS_NOTES: Record<QuoteSnapshot['lines'][number]['status'], string | null> = {
  PRICED: null,
  NO_PRODUCT: 'No product linked',
  OVER_LIMIT: 'Too large for the cart',
  OUT_OF_STOCK: 'Out of stock',
  REMOVED: null,
};

/**
 * The material list a rate was asked for.
 *
 * The prices are the ones the server worked out when the request arrived, so
 * this is what the shop would have charged that day, not what the browser said.
 */
export function QuoteSnapshotTable({ quote }: { quote: QuoteSnapshot }) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div>
        <h2 className="font-semibold">Material list</h2>
        <ul className="text-muted-foreground mt-1 text-xs">
          {quote.jobs.map((job, index) => (
            <li key={index}>{job}</li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left">
          <thead className="text-muted-foreground bg-muted/40 text-xs">
            <tr>
              <th className="px-2.5 py-2 font-medium">Material</th>
              <th className="px-2.5 py-2 font-medium">Product</th>
              <th className="px-2.5 py-2 text-right font-medium">Qty</th>
              <th className="px-2.5 py-2 text-right font-medium">Rate</th>
              <th className="px-2.5 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {quote.lines.map((line) => (
              <tr key={line.material}>
                <td className="px-2.5 py-2 align-top">
                  <span className="block font-medium">{QUOTE_MATERIAL_LABELS[line.material].en}</span>
                  <span className="text-muted-foreground block text-xs">{line.needed}</span>
                </td>
                <td className="px-2.5 py-2 align-top">
                  {line.productName ?? '—'}
                  {STATUS_NOTES[line.status] && (
                    <span className="block text-xs text-[var(--warning-fg)]">
                      {STATUS_NOTES[line.status]}
                    </span>
                  )}
                </td>
                <td className="tabular px-2.5 py-2 text-right align-top">
                  {line.quantity ?? '—'}
                  {line.unitLabel && (
                    <span className="text-muted-foreground block text-xs">{line.unitLabel}</span>
                  )}
                </td>
                <td className="tabular px-2.5 py-2 text-right align-top">
                  {line.unitPrice ? formatINR(line.unitPrice) : '—'}
                </td>
                <td className="tabular px-2.5 py-2 text-right align-top">
                  {line.lineTotal ? formatINR(line.lineTotal) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="tabular ml-auto flex w-full max-w-[260px] flex-col gap-1">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Materials</dt>
          <dd>{formatINR(quote.subtotal)}</dd>
        </div>
        {quote.taxAddedTotal !== '0.00' && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">GST added</dt>
            <dd>{formatINR(quote.taxAddedTotal)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">
            Delivery{quote.pincode ? ` to ${quote.pincode}` : ''}
          </dt>
          <dd>{formatINR(quote.deliveryCharge)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t pt-1 font-semibold">
          <dt>Total</dt>
          <dd>{formatINR(quote.grandTotal)}</dd>
        </div>
      </dl>
    </section>
  );
}
