import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // PGlite spins up a WASM Postgres per suite; give slower CI runners room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}', 'netlify/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        'src/test/**',
        // Framework glue with no branching of our own: the root layout (it
        // renders <html>/<body>, which cannot be mounted in jsdom), the Clerk
        // middleware matcher and the CLI entrypoints.
        'src/app/layout.tsx',
        'src/proxy.ts',
        'src/db/migrate.ts',
        'src/ingest/run.ts',
        'src/domain/types.ts',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
