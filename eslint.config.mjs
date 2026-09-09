import js from '@eslint/js';
import globals from 'globals';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * The admin's flat config.
 *
 * The rule worth reading is the last one. This app must not import
 * `@buildkart/core` or `@buildkart/database`: it holds no database credentials
 * and reaches its data over HTTP, which was proved by running it with
 * `DATABASE_URL` removed from its environment.
 *
 * That property is now enforced by something stronger than lint — the admin is
 * a separate repository, and there is no such package to install. The rule stays
 * anyway, because "cannot resolve module" is a far worse explanation than a
 * sentence saying why the import is wrong, and because someone will eventually
 * try to add the dependency back rather than reach for the API.
 */

const IGNORES = ['**/node_modules/**', '**/.next/**', '**/.turbo/**'];

export default tseslint.config(
  { ignores: IGNORES },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Components run in a browser as well as on the server.
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      // The codebase uses `_`-prefixed names for deliberate discards.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  /*
   * Next's plugins, loaded directly rather than through `eslint-config-next`.
   *
   * That preset bundles an `eslint-plugin-react` still using ESLint 9's rule
   * context API, so under the pinned ESLint 10 every file here dies with
   * "contextOrFilename.getFilename is not a function". These two are the halves
   * actually worth having — the image and script rules, and the hooks dependency
   * check — and they load cleanly on their own.
   *
   * Registering them is also what makes the existing
   * `// eslint-disable-next-line @next/next/no-img-element` comments meaningful
   * again; without the plugin, ESLint rejects a directive naming a rule it does
   * not know.
   */
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // App Router only — there is no `pages/` directory for this rule to scan,
      // and it warns on every run looking for one.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },

  // --- no database, no domain layer. This is Phase 5, enforced ------------
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@buildkart/core',
              message:
                'The admin reaches data through the API. Importing core would give this app a database dependency again.',
            },
            {
              name: '@buildkart/database',
              message: 'The admin holds no database credentials. Use the API.',
            },
          ],
        },
      ],
    },
  },

  // Config files and scripts are plain Node.
  {
    files: ['**/*.mjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
