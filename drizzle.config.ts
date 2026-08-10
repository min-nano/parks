/**
 * Configuration for the `drizzle-kit` CLI, used ad hoc via `npm run db:generate`
 * to diff the schema or scaffold future migration SQL.
 *
 * `drizzle-kit` is deliberately not a dependency: it pulls in the deprecated
 * `@esbuild-kit/*` packages, which pin a vulnerable esbuild. `npx` fetches it
 * only when someone actually runs it. The migrations the app applies live in
 * `src/db/migrations.ts` so the same code path works on Neon, local Postgres and
 * the in-process PGlite used by the tests.
 */
const config = {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
};

export default config;
