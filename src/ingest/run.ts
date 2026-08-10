/* eslint-disable no-console */
import { getDatabase } from '@/db/client';

import { configuredAdapters } from './adapters';
import { runIngest } from './pipeline';

async function main(): Promise<void> {
  const adapters = configuredAdapters();
  if (adapters.length === 0) {
    console.warn('No adapters configured. Set INGEST_SOURCES to a JSON array of feeds.');
    return;
  }

  const db = await getDatabase();
  const summary = await runIngest(db, adapters);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
