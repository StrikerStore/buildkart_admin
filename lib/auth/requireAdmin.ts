import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { can, type AdminRole, type Permission } from '@StrikerStore/contract';
import { apiClient } from '@/lib/api/client';
import { SESSION_COOKIE } from './cookie';

export type CurrentAdmin = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
};

/**
 * The real authentication check.
 *
 * Asks `backend/api` who the cookie belongs to. This app cannot answer that
 * itself any more — it holds no signing key — which is the point: an app that
 * cannot verify a signature has no reason to hold the secret that would let it.
 *
 * The API does both halves: the signature, and then the database lookup that
 * catches a token whose account was since deactivated or whose password
 * changed. A valid signature is not a live session.
 *
 * Wrapped in React's `cache` so a page that calls this in its own body and
 * again in three child components costs one round trip per request, not four.
 */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await apiClient(token).auth.me.query({ token });
  } catch (error) {
    // A failure to reach the API is not "signed out" — but there is nothing
    // safe to do with a session we cannot confirm, so it is treated as one.
    // The log is what distinguishes an outage from a wave of expired cookies.
    console.error('[auth] could not verify the session with the API', error);
    return null;
  }
});

/** Redirects to the login page when there is no valid session. */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/login');
  return admin;
}

/**
 * Throws rather than redirects when a permission is missing.
 *
 * A redirect is right for a page (the browser follows it); inside a server
 * action it would be silently swallowed and look like success, so a missing
 * permission has to be loud.
 *
 * Core asserts the same permission again beside the query. This is the early,
 * legible refusal; that one is the boundary.
 */
export async function requirePermission(permission: Permission): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (!can(admin.role, permission)) {
    throw new Error(`Forbidden: ${admin.role} lacks ${permission}`);
  }
  return admin;
}
