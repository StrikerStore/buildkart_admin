import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPinnedIcon } from 'lucide-react';
import { formatStoreDate } from '@buildkart/contract';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { NotifyRequestsButton } from '@/components/delivery/NotifyRequestsButton';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Area requests' };

/**
 * Where customers wanted delivery and could not get it.
 *
 * Grouped by pincode rather than listed one per person, because the question
 * this screen answers is "where should we expand next" — and that is a question
 * about areas, not about individuals.
 */
export default async function PincodeRequestsPage() {
  await requireAdmin();
  const grouped = await (await api()).operations.areaRequests.query();

  return (
    <PageContainer>
      <PageHeader
        title="Area requests"
        subtitle={
          grouped.length > 0
            ? `${grouped.length} pincode${grouped.length === 1 ? '' : 's'} asked for`
            : 'Customers who wanted delivery where BuildKart does not reach.'
        }
      />

      {grouped.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <MapPinnedIcon className="text-muted-foreground size-8" strokeWidth={1.5} />
          <p className="font-medium">No requests yet</p>
          <p className="text-muted-foreground max-w-[420px]">
            When someone enters a pincode the storefront does not serve, it lands here — so
            expansion follows demand rather than guesswork.
          </p>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-card)]">
          <div className="text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium sm:flex">
            <span className="w-[84px] shrink-0">Pincode</span>
            <span className="min-w-0 flex-1">Status</span>
            <span className="w-[90px] shrink-0 text-right">People</span>
            <span className="w-[90px] shrink-0 text-right">Asks</span>
            <span className="w-[110px] shrink-0 text-right">Last asked</span>
            <span className="w-[128px] shrink-0" />
          </div>

          <ul>
            {grouped.map((row) => {
              const isServiced = row.serviceable !== null;
              const isActive = row.serviceable === true;
              const waiting = row.pending;

              return (
                <li
                  key={row.pincode}
                  className="flex flex-wrap items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                >
                  <span className="tabular w-[84px] shrink-0 font-medium">{row.pincode}</span>

                  <span className="min-w-0 flex-1 text-xs">
                    {isActive ? (
                      <span className="rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[var(--success-fg)]">
                        Now delivering
                      </span>
                    ) : isServiced ? (
                      <span className="rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[var(--warning-fg)]">
                        Listed but paused
                      </span>
                    ) : (
                      <Link
                        href="/delivery/pincodes"
                        className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      >
                        Not covered — add it
                      </Link>
                    )}
                  </span>

                  <span className="tabular w-[90px] shrink-0 text-right font-medium">
                    {row.requesters}
                  </span>
                  <span className="tabular text-muted-foreground w-[90px] shrink-0 text-right text-xs">
                    {row.asks}
                  </span>
                  <span className="text-muted-foreground w-[110px] shrink-0 text-right text-xs">
                    {row.lastRequestedAt ? formatStoreDate(row.lastRequestedAt) : '—'}
                  </span>

                  <span className="flex w-[128px] shrink-0 justify-end">
                    {/* Only offered once the area is actually live: telling
                        people it opened before it has would be worse than
                        saying nothing. */}
                    {isActive && waiting > 0 && (
                      <NotifyRequestsButton pincode={row.pincode} waiting={waiting} />
                    )}
                    {isActive && waiting === 0 && (
                      <span className="text-muted-foreground text-xs">All told</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </PageContainer>
  );
}
