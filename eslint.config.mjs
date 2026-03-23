import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import unusedImports from 'eslint-plugin-unused-imports';
import packageJson from './package.json' with { type: 'json' };

const reactVersion = packageJson.dependencies.react;

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
    plugins: {
      'unused-imports': unusedImports,
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
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  globalIgnores(['.next/**', 'node_modules/**', 'public/**', 'generated/**', 'docs/**', 'scripts/cleanup-demo-workspaces.js', 'next-env.d.ts']),
]);

export default eslintConfig;
