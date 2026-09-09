import 'server-only';
import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@StrikerStore/contract';

/**
 * The admin's client for `backend/api`.
 *
 * `AppRouter` is a **type-only** import: no API code is bundled into this app,
 * but every procedure keeps its signature across the boundary, so a changed
 * argument breaks the build rather than a request.
 *
 * `httpBatchLink` is deliberate — it collapses the calls one render makes into a
 * single request, which is the mitigation for the N+1-over-HTTP risk the
 * architecture calls out.
 */
function apiUrl(): string {
  const url = process.env.API_URL;
  if (!url) {
    throw new Error(
      'API_URL is not set. The admin reaches backend/api over it — see .env.example.',
    );
  }
  const trimmed = url.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      `API_URL must include http:// or https:// (got "${url}"). Example: https://api.buildkart.co`,
    );
  }
  return trimmed;
}

/**
 * Builds a client for one request.
 *
 * Per-request rather than a module singleton because the session token differs
 * per caller, and a shared client would leak one admin's token into another's
 * request under concurrency.
 */
export function apiClient(sessionToken?: string | undefined, clientIp?: string | null) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: apiUrl(),
        headers() {
          return {
            // Proves this is one of our apps. Not identity — every request from
            // the admin carries the same value.
            'x-service-token': process.env.SERVICE_TOKEN ?? '',
            ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
            /*
             * The browser's address, forwarded on.
             *
             * The API is a hop removed from the customer now, so left alone it
             * would stamp every audit row with this container's IP — or, as it
             * turned out, with nothing at all. Forwarding is only safe because
             * the caller is authenticated by the service token above; an
             * unauthenticated caller's x-forwarded-for is never believed.
             */
            ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
          };
        },
      }),
    ],
  });
}

/** The tRPC error code, when the failure came from the API rather than the wire. */
export function apiErrorCode(error: unknown): string | null {
  return error instanceof TRPCClientError ? ((error.data as { code?: string })?.code ?? null) : null;
}
