'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDayKey, formatINR, moneyAxisFormatter } from '@StrikerStore/contract';

export type SeriesFormat = 'money' | 'count' | 'percent';

/**
 * One measure per day — the analytics pages' sibling of the Home dashboard's
 * `TrendChart`, with the same marks, generalised to any series.
 *
 * Deliberately one series and one axis. Spend and revenue, or sessions and
 * conversion rate, share a time axis but not a scale; they are drawn as two
 * charts side by side rather than one chart with two y-axes, which would
 * invent a relationship the data does not contain.
 */
export function SeriesChart({
  points,
  format,
  color,
  unit,
}: {
  points: Array<{ day: string; value: number }>;
  format: SeriesFormat;
  /** A CSS custom property name, so the hue lives in the token layer. */
  color: string;
  /** For counts, the noun in the tooltip: "session", "order". */
  unit?: string;
}) {
  const stroke = `var(${color})`;
  const peak = Math.max(...points.map((point) => point.value), 0);
  // A flat all-zero series would otherwise hug the top of the plot.
  const domainTop = peak === 0 ? 1 : undefined;
  // Enough ticks to orient, never one per day.
  const tickGap = Math.max(1, Math.ceil(points.length / 6));

  const describe = (value: number) => {
    if (format === 'money') return formatINR(value.toFixed(2));
    if (format === 'percent') return `${(value * 100).toFixed(2)}%`;
    return `${value.toLocaleString('en-IN')}${unit ? ` ${unit}${value === 1 ? '' : 's'}` : ''}`;
  };

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDayKey}
            interval={tickGap - 1}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)' }}
            minTickGap={16}
          />
          <YAxis
            width={56}
            domain={[0, domainTop ?? 'auto']}
            allowDecimals={format !== 'count'}
            tickFormatter={
              format === 'money'
                ? moneyAxisFormatter(peak)
                : format === 'percent'
                  ? (value: number) => `${Math.round(value * 1000) / 10}%`
                  : (value: number) => String(value)
            }
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-card rounded-md border px-2.5 py-1.5 text-xs shadow-[var(--shadow-card)]">
                  <div className="text-muted-foreground">{formatDayKey(String(label))}</div>
                  {/* Text wears text tokens; the swatch beside it carries identity. */}
                  <div className="flex items-center gap-1.5 font-medium">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: stroke }}
                    />
                    {describe(payload[0]?.value as number)}
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={stroke}
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)', fill: stroke }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
