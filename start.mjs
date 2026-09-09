/**
 * Starts the standalone Next server produced by `next build` + `postbuild.mjs`.
 * `next start` is incompatible with `output: 'standalone'`.
 *
 * Railway (and most PaaS) health-checks the container from outside. Next's
 * standalone server binds to `process.env.HOSTNAME`; Railway sets that to the
 * container id, so the proxy cannot reach it and the deploy is SIGTERM'd.
 * Always listen on 0.0.0.0.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const standalone = join(appDir, '.next', 'standalone');

function findServerJs(dir, depth = 0) {
  if (depth > 4 || !existsSync(dir)) return null;
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && e.name === 'server.js')) {
    return join(dir, 'server.js');
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    const found = findServerJs(join(dir, entry.name), depth + 1);
    if (found) return found;
  }
  return null;
}

const serverJs = findServerJs(standalone);
if (!serverJs) {
  console.error('[start] .next/standalone/**/server.js not found. Run npm run build first.');
  process.exit(1);
}

const child = spawn(process.execPath, [serverJs], {
  stdio: 'inherit',
  cwd: dirname(serverJs),
  env: {
    ...process.env,
    HOSTNAME: '0.0.0.0',
    PORT: process.env.PORT ?? '3000',
  },
});

const stop = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 1);
});
