import { formatINR, type CityPerformanceDto } from '@StrikerStore/contract';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { percent } from '@/lib/analytics-query';
import { CsvButton } from './CsvButton';

/** What the null city means on screen: no area chosen, or no city on the order. */
const UNKNOWN = 'Not chosen';

/**
 * Sessions and orders per city — the Acquisition page's for every channel,
 * the Meta ads page's for paid social only.
 */
export function CityTable({ rows, empty }: { rows: CityPerformanceDto[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-xs">{empty}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>City</TableHead>
          <TableHead className="text-right">Sessions</TableHead>
          <TableHead className="text-right">Added to cart</TableHead>
          <TableHead className="text-right">Conv. rate</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className="text-right">New customers</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.city ?? ''}>
            <TableCell className={row.city === null ? 'text-muted-foreground' : undefined}>
              {row.city ?? UNKNOWN}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.sessions.toLocaleString('en-IN')}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.cartSessions.toLocaleString('en-IN')}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {percent(row.conversionRate, 2)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
            <TableCell className="text-right tabular-nums">{row.newCustomers}</TableCell>
            <TableCell className="text-right tabular-nums">{formatINR(row.revenue)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** The same rows as a CSV download, for the card's actions slot. */
export function CityCsvButton({ rows, filename }: { rows: CityPerformanceDto[]; filename: string }) {
  return (
    <CsvButton
      filename={filename}
      columns={[
        'City',
        'Sessions',
        'Added to cart',
        'Ordered sessions',
        'Conversion rate',
        'Orders',
        'New customers',
        'Revenue',
      ]}
      rows={rows.map((row) => [
        row.city ?? UNKNOWN,
        row.sessions,
        row.cartSessions,
        row.convertedSessions,
        row.conversionRate === null ? '' : row.conversionRate.toFixed(4),
        row.orders,
        row.newCustomers,
        row.revenue,
      ])}
    />
  );
}
