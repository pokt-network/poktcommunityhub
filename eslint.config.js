import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Package boundaries (build brief section 3).
 *
 * `packages/*\/src/index.ts` is the only import surface. There are two ways round
 * that, so two guards: a deep import through the package name, and a relative
 * path into another package. `tools/verify-boundaries.mjs` lints fixtures that
 * break each rule and fails if the rule stays silent, so the guard cannot rot.
 */
const packageBoundaries = {
  patterns: [
    {
      group: [
        '@community/*/src',
        '@community/*/src/**',
        '@community/*/dist',
        '@community/*/dist/**',
      ],
      message:
        "Package internals are not importable. Import the package root; 'packages/*/src/index.ts' is the only import surface (brief section 3).",
    },
    {
      group: ['**/../packages/**', '../../*/src/**', '../../../**'],
      message:
        'Cross-package imports go through the package name, never a relative path (brief section 3).',
    },
  ],
};

/**
 * Packages never import the apps. The apps are composition roots; a package that
 * reaches into one can no longer be tested or reused without it.
 */
const packagesStayBelowApps = {
  ...packageBoundaries,
  patterns: [
    ...packageBoundaries.patterns,
    {
      group: ['@community/web', '@community/web/**', '@community/worker', '@community/worker/**'],
      message: 'Packages must not import an app. Apps compose packages, never the reverse.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/*.d.ts',
      'tools/lint-fixtures/**',
      'apps/web/next-env.d.ts',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs'],
    rules: {
      'no-restricted-imports': ['error', packageBoundaries],
      eqeqeq: ['error', 'always'],
      'no-implicit-coercion': 'error',
      'no-throw-literal': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  {
    files: ['packages/**/*.ts', 'tools/lint-fixtures/package-imports-app.ts'],
    rules: {
      'no-restricted-imports': ['error', packagesStayBelowApps],
    },
  },

  {
    files: ['**/*.test.ts', 'tools/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  {
    // Plain-JS tooling runs on Node and touches Node globals directly.
    files: ['tools/**/*.mjs', '*.config.js', '*.config.mjs', 'apps/*/*.config.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
);
