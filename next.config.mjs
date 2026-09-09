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
   * No `transpilePackages` either. `@buildkart/contract` ships compiled
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
