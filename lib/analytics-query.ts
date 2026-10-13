import { ANALYTICS_RANGES, type AnalyticsQuery, type AnalyticsRange } from '@StrikerStore/contract';

type SearchParams = Record<string, string | string[] | undefined>;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The analytics period a page's URL asks for: `?range=7d`, or a custom
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD`. The API validates and resolves it
 * (`resolveAnalyticsPeriod`), so this only passes on what looks like one.
 */
export function readAnalyticsQuery(params: SearchParams): AnalyticsQuery {
  const one = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : undefined;
  const range = one('range');
  const from = one('from');
  const to = one('to');
  return {
    ...(range && (ANALYTICS_RANGES as readonly string[]).includes(range)
      ? { range: range as AnalyticsRange }
      : {}),
    ...(from && DAY_KEY.test(from) ? { from } : {}),
    ...(to && DAY_KEY.test(to) ? { to } : {}),
  };
}

/** The same period as a query string, for links between the analytics pages. */
export function analyticsQueryString(query: AnalyticsQuery): string {
  const params = new URLSearchParams();
  if (query.from && query.to) {
    params.set('from', query.from);
    params.set('to', query.to);
  } else if (query.range && query.range !== '30d') {
    params.set('range', query.range);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const percent = (value: number | null, digits = 1) =>
  value === null ? '—' : `${(value * 100).toFixed(digits)}%`;

export const times = (value: number | null) => (value === null ? '—' : `${value.toFixed(2)}×`);
