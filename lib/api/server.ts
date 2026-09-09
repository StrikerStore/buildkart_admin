import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { apiClient } from './client';
import { SESSION_COOKIE } from '@/lib/auth/cookie';
import { headers } from 'next/headers';

/**
 * An API client carrying this request's session.
 *
 * Every page and action goes through here rather than building its own, so the
 * session token is attached in exactly one place. `cache` makes it one client
 * per request instead of one per call site — the batch link then collapses the
 * calls a single render makes into one HTTP request, which is the whole defence
 * against turning five Prisma queries into five round trips.
 */
/**
 * Railway terminates TLS at its proxy, so the socket address is always the
 * proxy's. The leftmost x-forwarded-for entry is the closest thing to the real
 * client — good enough for an audit trail, and not trusted for anything else.
 */
async function clientIp(): Promise<string | null> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  return headerList.get('x-real-ip')?.slice(0, 45) ?? null;
}

export const api = cache(async () => {
  const [token, ip] = await Promise.all([
    cookies().then((store) => store.get(SESSION_COOKIE)?.value),
    clientIp(),
  ]);
  // The IP travels with the call so the audit trail still records the person at
  // the keyboard rather than this container.
  return apiClient(token, ip);
});

/**
 * Server configuration the admin is told rather than deduces.
 *
 * Whether R2 can be written to depends on credentials this app does not hold,
 * and the public image base URL comes back with it so a page needs one call for
 * both. Per-request cached, so several components asking cost one round trip.
 */
export const serverConfig = cache(async () => (await api()).content.config.query());
