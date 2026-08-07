import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import unusedImports from 'eslint-plugin-unused-imports';
import i18next from 'eslint-plugin-i18next';
import packageJson from './package.json' with { type: 'json' };

const reactVersion = packageJson.dependencies.react;

const literalStringOptions = {
  markupOnly: true,
  ignoreAttribute: [
    'className',
    'class',
    'style',
    'href',
    'src',
    'id',
    'name',
    'type',
    'role',
    'data-theme',
    'data-testid',
    'data-cy',
    'htmlFor',
    'autoComplete',
    'method',
    'action',
    'target',
    'rel',
    'xmlns',
    'viewBox',
    'fill',
    'stroke',
    'd',
    'key',
    'as',
    'variant',
    'size',
    'joinItem',
    'spelling',
    'entityType',
    'to',
    'from',
    'tabIndex',
    'alt',
    // Keep technical/a11y attrs ignored; do NOT ignore `title` — many UI labels use it (e.g. StatCard).
    'placeholder',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
  ],
  ignore: [
    '^[A-Z0-9_\\-./:#•]+$',
    '^\\s*$',
    '^€',
    '^%[sd]$',
    '^\\d+$',
    '^[#.].*',
    '^v\\d',
    '^[\\d.,\\s/%+\u2212\\-–—]+$',
    '^[=×xX]+$',
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    //// eslint-plugin-react was not able to detect the correct React version (incompatible with eslint v10)
    settings: {
      react: {
        version: reactVersion,
      },
    },
  },
  {
    // Scope to the same extensions Next's react-hooks plugin covers; avoid applying
    // react-hooks/* rules to .mjs config/scripts where that plugin is not registered.
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'unused-imports': unusedImports,
      i18next,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      // Match main: React Compiler hook rules stay warnings until systematically cleaned up
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // Fail CI / IDE when JSX text is not translated
      'i18next/no-literal-string': ['error', literalStringOptions],
    },
  },
  {
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: [
      '**/*.{test,spec}.{ts,tsx}',
      'test/**/*.{ts,tsx}',
      'scripts/**/*.{ts,tsx,js,mjs}',
      'prisma/**/*.{ts,js}',
      'pages/api/**/*.{ts,tsx}',
      'lib/api/**/*.{ts,tsx}',
      // PDF markup is locale-resolved by callers; keep out of UI chrome lint
      'components/pdf/**/*.{ts,tsx}',
    ],
    rules: {
      'i18next/no-literal-string': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'public/**',
    'generated/**',
    'docs/**',
    'scripts/cleanup-demo-workspaces.js',
    'next-env.d.ts',
    'eslint.config.mjs',
    'i18next-parser.config.cjs',
  ]),
]);

export default eslintConfig;
