/**
 * Guards the version pins this app's build structurally depends on.
 *
 * `typescript`'s `latest` tag resolves to the 7.0 Go rewrite, which Next's
 * compiler plugin is not validated against; `next`, `react` and `tailwindcss`
 * are pinned together because a mismatch between them fails at build time in
 * ways that read as application bugs.
 *
 * The backend has its own copy of this check, guarding `prisma` and
 * `@prisma/client`. Those are deliberately not asserted here — this app holds no
 * database dependency, and that is the property the split exists to keep.
 *
 * Run: npm run check:pins
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Finds an installed package the way Node itself would — by walking up from
 * this script looking for `node_modules/<name>`, so the check keeps working
 * whether the tree is hoisted to a monorepo root or installed locally.
 */
function findPackageJson(name) {
  let dir = here;
  for (;;) {
    const candidate = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir || dir === parse(dir).root) return null;
    dir = parent;
  }
}

/** Package name -> exact version that must be installed. */
const REQUIRED = {
  next: '16.3.3',
  react: '19.2.8',
  'react-dom': '19.2.8',
  typescript: '5.9.3',
  tailwindcss: '4.3.3',
};

const failures = [];

for (const [name, expected] of Object.entries(REQUIRED)) {
  const pkgPath = findPackageJson(name);
  if (!pkgPath) {
    failures.push(`${name}: not installed (expected ${expected})`);
    continue;
  }
  const actual = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  if (actual !== expected) {
    failures.push(`${name}: found ${actual}, expected exactly ${expected}`);
  }
}

if (failures.length > 0) {
  console.error('\nVersion pin check FAILED:\n');
  for (const f of failures) console.error(`  - ${f}`);
  console.error('');
  process.exit(1);
}

console.log('Version pins OK:', Object.keys(REQUIRED).join(', '));
