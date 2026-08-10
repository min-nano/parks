import { z } from 'zod';

import type { IngestAdapter } from '../pipeline';
import { createHttpJsonAdapter } from './http-json';

const adapterConfigSchema = z.object({
  source: z.string().min(1),
  label: z.string().min(1),
  endpoint: z.url(),
});

export const adapterConfigListSchema = z.array(adapterConfigSchema);

export type AdapterConfig = z.infer<typeof adapterConfigSchema>;

/**
 * Reads `INGEST_SOURCES` — a JSON array of `{ source, label, endpoint }` — so new
 * operator feeds can be added without a deploy.
 */
export function configuredAdapters(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): IngestAdapter[] {
  const raw = env.INGEST_SOURCES;
  if (!raw) return [];

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('INGEST_SOURCES must be valid JSON');
  }

  const parsed = adapterConfigListSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `INGEST_SOURCES is malformed: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
    );
  }

  return parsed.data.map((config) => createHttpJsonAdapter({ ...config, fetchImpl }));
}
