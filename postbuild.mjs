/**
 * Completes the standalone build.
 *
 * `output: 'standalone'` traces the server and its dependencies into
 * `.next/standalone`, but deliberately leaves out `.next/static` and `public` —
 * Next assumes a CDN will serve them. Nothing here does, so without this step
 * the deployed admin answers 200 for a page and 404 for every stylesheet and
 * script on it: a login form with no styling and no interactivity, which looks
 * like a broken app rather than a missing copy step.
 *
 * Run automatically after `next build`.
 */
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const standalone = join(appDir, '.next', 'standalone');

/**
 * Finds the directory `server.js` was traced into.
 *
 * Next mirrors the path from the app to `outputFileTracingRoot`, so the depth
 * depends on the shape of the checkout: inside a monorepo the server lands at
 * `standalone/admin/server.js`, and once the admin is its own repository it
 * lands at `standalone/server.js`. Hardcoding either one means this script
 * breaks on the day the layout changes — and it breaks *quietly*, by copying
 * nothing, which shows up as an unstyled login page in production rather than a
 * failed build. Searching for the file costs a few milliseconds and is right in
 * both layouts.
 */
function findServerDir(dir, depth = 0) {
  if (depth > 4) return null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  if (entries.some((e) => e.isFile() && e.name === 'server.js')) return dir;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    const found = findServerDir(join(dir, entry.name), depth + 1);
    if (found) return found;
  }
  return null;
}

if (!existsSync(standalone)) {
  console.error(
    '[postbuild] .next/standalone not found. Did next build run with output: "standalone"?',
  );
  process.exit(1);
}

const standaloneApp = findServerDir(standalone);

if (!standaloneApp) {
  console.error('[postbuild] no server.js found under .next/standalone — nothing to complete.');
  process.exit(1);
}

cpSync(join(appDir, '.next', 'static'), join(standaloneApp, '.next', 'static'), {
  recursive: true,
});

const publicDir = join(appDir, 'public');
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standaloneApp, 'public'), { recursive: true });
}

const where = relative(appDir, standaloneApp).split(sep).join('/');
console.log(`[postbuild] copied .next/static into the standalone output (${where})`);
