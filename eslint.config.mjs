import js from '@eslint/js';
import next from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      '.netlify/**',
      'coverage/**',
      'node_modules/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**'],
    rules: {
      // Test doubles legitimately stand in for shapes we do not want to rebuild.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
