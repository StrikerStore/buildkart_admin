import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The directory Turbopack should treat as the workspace root.
 *
 * Next infers this from the nearest lockfile but stops at the enclosing git
 * repository — and since this app became its own repository the only lockfile
 * sits one directory above it, outside. Turbopack then resolves from this app
 * alone, cannot see the hoisted `node_modules`, and fails to find `next` itself.
 *
 * So the search happens here instead, on the same rule the `outputFileTracingRoot`
 * note below relies on: walk up to whoever owns the lockfile. Today that is the
 * monorepo root where `node_modules` is hoisted; once this app is installed on
 * its own it is this directory. Neither layout needs the value edited, which is
 * the point — a root pinned to one of them would have to be changed on the day
 * of the split, and that is exactly the edit that gets forgotten until a build
 * fails.
 */
function workspaceRoot() {
  const here = dirname(fileURLToPath(import.meta.url));

  for (let dir = here; ; ) {
    if (existsSync(join(dir, 'package-lock.json'))) return dir;
    const parent = dirname(dir);
    // Filesystem root reached with no lockfile anywhere: fall back to this app,
    // which is what Next would have chosen unaided.
    if (parent === dir) return here;
    dir = parent;
  }
}

/*
 * No dotenv call here.
 *
 * Next already loads `admin/.env` — its own app directory — on its own. The
 * explicit load existed only to reach the *root* `.env`, back when one file
 * configured the whole monorepo. This app is not allowed near the database
 * credentials, and not loading them is half of what makes that true.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // See `workspaceRoot` above: without this Turbopack cannot find the
  // hoisted `node_modules` now that this app is its own git repository.
  turbopack: { root: workspaceRoot() },

  /*
   * Railway builds with Nixpacks; standalone keeps the runtime image small.
   *
   * `outputFileTracingRoot` is deliberately **not** set. Next infers it from the
   * nearest lockfile, which is the correct answer in both layouts this app has
   * to survive: today it finds the monorepo root, where `node_modules` is
   * hoisted; once the admin is its own repository it finds `admin/` itself.
   * Pinning it to one of those would have to be changed on the day of the split,
   * which is exactly the kind of edit that gets forgotten until a container
   * crashes on first request. `postbuild.mjs` locates the output the same way,
   * rather than assuming where it landed.
   */
  output: 'standalone',

  /*
   * No `transpilePackages` either. `@StrikerStore/contract` ships compiled
   * JavaScript with its own declarations — that is the whole point of the
   * package — so there is nothing left to transpile. `core` and `database` are
   * gone from this app entirely: it reaches data over HTTP, so there is no
   * Prisma client to compile and no native driver to keep out of the bundle.
   */

  experimental: {
    serverActions: {
      // The default is 1 MB. A product with a large variant matrix plus
      // metafields exceeds that in one save.
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
