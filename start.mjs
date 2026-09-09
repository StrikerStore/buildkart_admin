/**
 * Starts the standalone Next server produced by `next build` + `postbuild.mjs`.
 * `next start` is incompatible with `output: 'standalone'`.
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
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
