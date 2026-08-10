/* eslint-disable no-console */
import { createNeonDatabase, runMigrations } from './client';
import { seedDatabase } from './seed';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to run migrations');

  const db = await createNeonDatabase(url);
  await runMigrations(db);
  console.log('migrations applied');

  if (process.argv.includes('--seed')) {
    const result = await seedDatabase(db);
    console.log(`seeded ${result.parkings} parkings, ${result.snapshots} snapshots`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
