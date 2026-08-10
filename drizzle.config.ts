import { defineConfig } from 'drizzle-kit';

/**
 * Only used for `drizzle-kit` inspection and for generating future migrations.
 * The migrations the app actually applies live in `src/db/migrations.ts` so the
 * same code path works on Neon, local Postgres and the in-process PGlite.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
