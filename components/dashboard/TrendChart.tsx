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
import { formatDayKey, formatINR, moneyAxisFormatter, type DailyPoint } from '@buildkart/contract';

type Metric = 'revenue' | 'orders';

/**
 * One measure over time.
 *
 * Deliberately one series per chart. Revenue and order count share a time axis
 * but not a scale, and putting them on one plot with two y-axes would invent a
 * correlation the data does not contain — so they are two charts, side by side.
 */
export function TrendChart({
  points,
  metric,
  color,
}: {
  points: DailyPoint[];
  metric: Metric;
  /** A CSS custom property name, so the hue lives in the token layer. */
  color: string;
}) {
  const isMoney = metric === 'revenue';
  const stroke = `var(${color})`;

  const data = points.map((point) => ({
    day: point.day,
    value: isMoney ? Number(point.revenue) : point.orders,
  }));

  // A flat all-zero series would otherwise render its line along the very top
  // of the plot, which reads as a full bar rather than as nothing.
  const peak = Math.max(...data.map((d) => d.value), 0);
  const domainTop = peak === 0 ? 1 : undefined;

  // Enough ticks to orient, never one per day — at 90 points they would collide.
  const tickGap = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          {/* Horizontal only, solid hairline, recessive — never dashed. */}
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeWidth={1}
            vertical={false}
          />

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
            allowDecimals={!isMoney ? false : true}
            tickFormatter={
              isMoney ? moneyAxisFormatter(peak) : (value: number) => String(value)
            }
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip
            cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const value = payload[0]?.value as number;
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
                    {isMoney
                      ? formatINR(value.toFixed(2))
                      : `${value} order${value === 1 ? '' : 's'}`}
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
            // A flat 10% wash. A gradient fading to 2% at the baseline made the
            // fill invisible under a low line, which is most of the chart.
            fill={stroke}
            fillOpacity={0.1}
            // No dot per point — a marker on all 90 would be noise. The active
            // dot carries a 2px surface ring so it stays legible on the line.
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)', fill: stroke }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
